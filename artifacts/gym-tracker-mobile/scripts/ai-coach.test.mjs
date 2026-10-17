import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { storage, secureStorage, request } from "./testHarness.mjs";
import { defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
const connection = await import("../lib/aiCoachConnection.ts");
const credentials = await import("../lib/aiCoachCredentials.ts");
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { setCoachProposal, clearCoachProposal, getCoachProposal } = await import("../lib/aiCoachPlan.ts");
const originalFetch = globalThis.fetch;
const token = "test-owner-token-not-a-provider-key-123456789";
const budget = { limitUsd: 5, usedUsd: 0.01, reservedUsd: 0 };
const reply = () => ({ summary: "Test recommendation", cautions: [], nextSet: { exerciseId: 1, weightKg: 42.5, reps: 10, durationSeconds: null, reason: "Observed reserve" }, plan: null });
const status = () => new Response(JSON.stringify({ ready: true, model: "gpt-6-luna", budget }));
beforeEach(async () => { delete globalThis.__secureStorageFault; await connection.disconnectAiCoach(); storage.clear(); secureStorage.clear(); clearCoachProposal(); });
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.__secureStorageFault; delete globalThis.__storageFault; });
async function context(task = "next_set") {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 10, rir: 2, technique: "good" });
  await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 40, reps: 10 } });
  return request("/api/ai-coach/context", "POST", { task, workoutId: workout.id });
}
async function enable(output = reply()) {
  globalThis.fetch = async (_url, options) => {
    if (options.method === "GET") return status();
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({ model: "gpt-6-luna", fingerprint: body.fingerprint, result: output, budget }));
  };
  await connection.connectAiCoach("https://coach.example.com", token);
  await connection.setAiConsent(true);
  await connection.setAiEnabled(true);
}

test("AI is off by default and performs no network calls without enabled consent/session", async () => {
  const ctx = await context();
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected network"); };
  assert.equal((await connection.readAiConnection()).enabled, false);
  await assert.rejects(connection.requestAiCoach(ctx));
  assert.equal(calls, 0);
  globalThis.fetch = async () => status();
  await connection.connectAiCoach("https://coach.example.com", token);
  await assert.rejects(connection.setAiEnabled(true));
});
test("context is bounded, uses actual nullable profile, and never includes storage secrets", async () => {
  storage.set("private-key", token);
  const ctx = await context();
  assert.equal(ctx.athlete.bodyWeightKg, null);
  assert.equal(ctx.athlete.sex, null);
  assert.equal(ctx.sessions[0].sets[0].rir, 2);
  assert.ok(!JSON.stringify(ctx).includes(token));
  assert.deepEqual(Object.keys(ctx).sort(), ["version", "task", "preferences", "athlete", "catalog", "sessions", "focus", "programs", "truncated", "loadSelection"].sort());
});
test("owner token is only in SecureStore; profile round-trips in v7, import disables AI", async () => {
  await context();
  const profile = { ...defaultCoachProfile(), goal: "strength", daysPerWeek: 4 };
  await request("/api/ai-coach/profile", "PUT", profile);
  await enable();
  assert.ok(![...storage.values()].some(text => text.includes(token)));
  assert.equal(JSON.parse(secureStorage.get(credentials.AI_CREDENTIAL_KEY)).token, token);
  const copy = await exportProgress();
  assert.equal(JSON.parse(copy).version, 9);
  assert.ok(!copy.includes("coach.example.com"));
  assert.ok(!copy.includes(token));
  await restoreProgress(copy);
  assert.deepEqual(await request("/api/ai-coach/profile"), profile);
  assert.equal((await connection.readAiConnection()).enabled, false);
});
test("invalid AI profile cannot overwrite progress; old backups remain accepted", async () => {
  await context();
  const before = await exportProgress();
  await assert.rejects(request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), equipment: [] }));
  assert.deepEqual(JSON.parse(await exportProgress()).state, JSON.parse(before).state);
  const legacy = JSON.parse(before); legacy.version = 6;
  await parseProgressBackup(JSON.stringify(legacy));
});
test("barbell, plank, excessive jumps, unknown/deleted/excluded exercises are rejected", async () => {
  const ctx = await context();
  for (const values of [{ weightKg: 2.5 }, { weightKg: 100 }, { weightKg: 41 }, { exerciseId: 999 }, { durationSeconds: 30 }]) assert.throws(() => validateCoachReply({ ...reply(), nextSet: { ...reply().nextSet, ...values } }, ctx));
  const noRir = structuredClone(ctx); noRir.sessions[0].sets[0].rir = null;
  assert.throws(() => validateCoachReply(reply(), noRir));
  const excluded = structuredClone(ctx); excluded.preferences.excludedExerciseIds = [1];
  assert.throws(() => validateCoachReply(reply(), excluded));
  const plank = structuredClone(ctx); plank.focus.draft = { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 30, rir: null, technique: null };
  const timed = { ...reply(), nextSet: { ...reply().nextSet, exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 30 } };
  assert.doesNotThrow(() => validateCoachReply(timed, plank));
  assert.throws(() => validateCoachReply({ ...timed, nextSet: { ...timed.nextSet, weightKg: 2.5 } }, plank));
});
test("a validated next set only changes the draft after confirmation, never records a set", async () => {
  const ctx = await context(); await enable();
  const answer = await connection.requestAiCoach(ctx);
  await connection.assertCoachAnswerCurrent(answer, ctx);
  const before = JSON.parse(await exportProgress()).state.sets.length;
  await request(`/api/workouts/${ctx.focus.workoutId}/draft`, "PUT", { revision: ctx.focus.draftRevision, coachFingerprint: answer.fingerprint, draft: { exerciseId: 1, weightKg: 42.5, reps: 10, rir: null, technique: null } });
  assert.equal(JSON.parse(await exportProgress()).state.sets.length, before);
  assert.equal((await request(`/api/workouts/${ctx.focus.workoutId}/draft`)).draft.weightKg, 42.5);
});
test("changed profile/draft and disable-reenable reject stale recommendations", async () => {
  const ctx = await context(); await enable();
  const answer = await connection.requestAiCoach(ctx);
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "strength" });
  const current = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: ctx.focus.workoutId });
  await assert.rejects(connection.assertCoachAnswerCurrent(answer, current));
  await assert.rejects(request(`/api/workouts/${ctx.focus.workoutId}/draft`, "PUT", { revision: ctx.focus.draftRevision, coachFingerprint: answer.fingerprint, draft: { exerciseId: 1, weightKg: 42.5, reps: 10 } }));
  await connection.disableAiCoach(); await connection.setAiEnabled(true);
  await assert.rejects(connection.assertCoachAnswerCurrent(answer, ctx));
});
test("late response after disabling is discarded even if fetch ignores abort", async () => {
  const ctx = await context(); await enable();
  let finish;
  let began;
  const started = new Promise(resolve => { began = resolve; });
  globalThis.fetch = async (_url, options) => { began(); return new Promise(resolve => { finish = () => resolve(new Response(JSON.stringify({ fingerprint: JSON.parse(options.body).fingerprint, model: "gpt-6-luna", result: reply(), budget }))); }); };
  const pending = connection.requestAiCoach(ctx);
  await started; await connection.disableAiCoach(); finish();
  await assert.rejects(pending, /./);
});
test("new weighted exercises need calibration and proposed plans remain unrecorded until saved", async () => {
  const ctx = await context("next_workout");
  const planned = { summary: "Plan", cautions: [], nextSet: null, plan: { name: "AI plan", description: "Editable", exercises: [{ exerciseId: 3, reason: "Test", targets: [{ weightKg: null, reps: 8, durationSeconds: null }] }] } };
  assert.doesNotThrow(() => validateCoachReply(planned, ctx));
  assert.throws(() => validateCoachReply({ ...planned, plan: { ...planned.plan, exercises: [{ ...planned.plan.exercises[0], targets: [{ weightKg: 50, reps: 8, durationSeconds: null }] }] } }, ctx));
  const draft = setCoachProposal(planned, ctx);
  assert.equal(draft.exercises[0].setTargets[0].weightKg, 2.5);
  assert.equal(draft.exercises[0].calibration, true);
  assert.equal(getCoachProposal(), draft);
  assert.equal(JSON.parse(await exportProgress()).state.customPrograms.length, 0);
  await restoreProgress(await exportProgress());
  assert.equal(getCoachProposal(), null);
});
test("insecure gateways, malformed responses and corrupt settings fail closed", async () => {
  assert.throws(() => connection.coachGatewayUrl("http://example.com"));
  assert.throws(() => connection.coachGatewayUrl("https://user:password@example.com"));
  assert.equal(connection.coachGatewayUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
  const ctx = await context(); await enable();
  globalThis.fetch = async () => new Response('{"result":"not valid"}');
  await assert.rejects(connection.requestAiCoach(ctx));
  storage.set(connection.AI_CONNECTION_KEY, "damaged");
  assert.equal((await connection.readAiConnection()).enabled, false);
  await restoreProgress(await exportProgress());
});
test("cold process restores saved credentials and the explicit enabled choice without network", async () => {
  const ctx = await context(); await enable();
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("network"); };
  const restarted = await import("../lib/aiCoachConnection.ts?fresh-process");
  assert.equal((await restarted.readAiConnection()).connected, true);
  assert.equal((await restarted.readAiConnection()).enabled, true);
  assert.equal(await restarted.readSavedAiCoachToken(), token);
  assert.equal(calls, 0);
  await restarted.disableAiCoach();
  await assert.rejects(restarted.requestAiCoach(ctx)); assert.equal(calls, 0);
});
test("connecting the same gateway again keeps AI enabled and recommendations usable", async () => {
  const ctx = await context(); await enable();
  const answer = await connection.requestAiCoach(ctx);
  const settings = storage.get(connection.AI_CONNECTION_KEY);
  const saved = secureStorage.get(credentials.AI_CREDENTIAL_KEY);
  let inferenceCalls = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "POST") {
      inferenceCalls++;
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({ model: "gpt-6-luna", fingerprint: body.fingerprint, result: reply(), budget }));
    }
    return status();
  };
  const verified = await connection.connectAiCoach("https://coach.example.com/", ` ${token} `);
  assert.equal(verified.ready, true);
  assert.equal((await connection.readAiConnection()).enabled, true);
  assert.equal((await connection.readAiConnection()).consent, true);
  assert.equal(storage.get(connection.AI_CONNECTION_KEY), settings);
  assert.equal(secureStorage.get(credentials.AI_CREDENTIAL_KEY), saved);
  await connection.assertCoachAnswerCurrent(answer, ctx);
  assert.equal(inferenceCalls, 0);
  await connection.assertCoachAnswerCurrent(await connection.requestAiCoach(ctx), ctx);
  assert.equal(inferenceCalls, 1);
});
test("checking the same gateway does not cancel an in-flight recommendation", async () => {
  const ctx = await context(); await enable();
  let finish, started;
  const began = new Promise(resolve => { started = resolve; });
  globalThis.fetch = async (_url, options) => {
    if (options.method === "GET") return status();
    started();
    return new Promise(resolve => { finish = () => resolve(new Response(JSON.stringify({ model: "gpt-6-luna", fingerprint: JSON.parse(options.body).fingerprint, result: reply(), budget }))); });
  };
  const pending = connection.requestAiCoach(ctx);
  await began;
  await connection.connectAiCoach("https://coach.example.com", token);
  finish();
  await connection.assertCoachAnswerCurrent(await pending, ctx);
});
test("connecting the same gateway does not enable an off coach or grant consent", async () => {
  globalThis.fetch = async () => status();
  await connection.connectAiCoach(connection.DEFAULT_COACH_URL, token);
  await connection.connectAiCoach(connection.DEFAULT_COACH_URL, token);
  assert.equal((await connection.readAiConnection()).enabled, false);
  assert.equal((await connection.readAiConnection()).consent, false);
});
test("a failed repeated connection check does not discard the enabled preference", async () => {
  await enable();
  globalThis.fetch = async () => { throw Error("offline"); };
  await assert.rejects(connection.connectAiCoach("https://coach.example.com", token));
  assert.equal((await connection.readAiConnection()).enabled, true);
  assert.equal((await connection.readAiConnection()).consent, true);
});
test("changing the token or host still requires explicitly enabling AI again", async () => {
  await enable();
  await connection.connectAiCoach("https://coach.example.com", "new-owner-token-" + "x".repeat(32));
  assert.equal((await connection.readAiConnection()).enabled, false);
  await connection.setAiEnabled(true);
  await connection.connectAiCoach("https://other.example.com", token);
  assert.equal((await connection.readAiConnection()).enabled, false);
  assert.equal((await connection.readAiConnection()).consent, false);
});
test("default address is filled without a token; an off coach remains off after restart", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("network"); };
  assert.equal((await connection.readAiConnection()).url, connection.DEFAULT_COACH_URL);
  assert.equal(await connection.readSavedAiCoachToken(), "");
  globalThis.fetch = async () => status();
  await connection.connectAiCoach(connection.DEFAULT_COACH_URL, token);
  await connection.setAiConsent(true);
  const restarted = await import("../lib/aiCoachConnection.ts?off-process");
  assert.equal((await restarted.readAiConnection()).connected, true);
  assert.equal((await restarted.readAiConnection()).enabled, false);
  assert.equal(calls, 0);
});
test("connection files strictly validate format, URL and owner token without touching progress", async () => {
  await context();
  const value = { format: "gym-beam-coach-connection", version: 1, url: connection.DEFAULT_COACH_URL, token };
  const before = await exportProgress();
  assert.deepEqual(credentials.parseAiCoachConnectionFile(JSON.stringify(value)), { url: value.url, token });
  for (const invalid of ["damaged", before, JSON.stringify({ ...value, extra: true }), JSON.stringify({ ...value, url: "http://example.com" }), JSON.stringify({ ...value, token: "sk-" + "x".repeat(40) }), " ".repeat(8193)]) assert.throws(() => credentials.parseAiCoachConnectionFile(invalid));
  assert.equal(await exportProgress().then(text => JSON.parse(text).checksum), JSON.parse(before).checksum);
  assert.equal(secureStorage.size, 0);
});
test("changing metadata cannot send a saved token to another host", async () => {
  const ctx = await context(); await enable();
  const saved = JSON.parse(storage.get(connection.AI_CONNECTION_KEY));
  storage.set(connection.AI_CONNECTION_KEY, JSON.stringify({ ...saved, url: "https://other.example.com" }));
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error("network"); };
  assert.equal((await connection.readAiConnection()).connected, false);
  await assert.rejects(connection.requestAiCoach(ctx));
  assert.equal(calls, 0);
});
test("forget deletes saved credentials and consent without deleting progress", async () => {
  await context(); await enable();
  const before = JSON.parse(await exportProgress()).checksum;
  await connection.disconnectAiCoach();
  assert.equal(secureStorage.size, 0);
  assert.equal((await connection.readAiConnection()).consent, false);
  const restarted = await import("../lib/aiCoachConnection.ts?forgotten-process");
  assert.equal((await restarted.readAiConnection()).connected, false);
  assert.equal(JSON.parse(await exportProgress()).checksum, before);
});
test("unavailable or damaged SecureStore fails closed and explicit reconnect replaces damaged values", async () => {
  await enable();
  globalThis.__secureStorageFault = async operation => { if (operation === "get") throw Error("keystore locked"); };
  const restarted = await import("../lib/aiCoachConnection.ts?locked-process");
  const current = await restarted.readAiConnection();
  assert.equal(current.connected, false); assert.equal(current.enabled, false);
  assert.ok(current.connectionError);
  delete globalThis.__secureStorageFault;
  secureStorage.set(credentials.AI_CREDENTIAL_KEY, "damaged");
  await connection.connectAiCoach(connection.DEFAULT_COACH_URL, token);
  assert.equal(await connection.readSavedAiCoachToken(), token);
});
test("failed credential writes cannot replace a previously verified connection", async () => {
  await enable();
  const before = secureStorage.get(credentials.AI_CREDENTIAL_KEY);
  globalThis.__secureStorageFault = async operation => { if (operation === "set") throw Error("keystore write failed"); };
  await assert.rejects(connection.connectAiCoach("https://other.example.com", "different-owner-token-" + "x".repeat(32)));
  delete globalThis.__secureStorageFault;
  assert.equal(secureStorage.get(credentials.AI_CREDENTIAL_KEY), before);
  assert.equal((await connection.readAiConnection()).url, "https://coach.example.com");
  assert.equal(await connection.readSavedAiCoachToken(), token);
});
test("a lost metadata acknowledgement restores the previous URL and verified token together", async () => {
  await enable();
  const before = storage.get(connection.AI_CONNECTION_KEY);
  let once = true;
  globalThis.__storageFault = ({ operation, key, phase }) => {
    if (once && operation === "setItem" && key === connection.AI_CONNECTION_KEY && phase === "after") { once = false; throw Error("acknowledgement lost"); }
  };
  await assert.rejects(connection.connectAiCoach("https://other.example.com", "different-owner-token-" + "x".repeat(32)));
  delete globalThis.__storageFault;
  assert.equal(storage.get(connection.AI_CONNECTION_KEY), before);
  assert.equal(await connection.readSavedAiCoachToken(), token);
});
test("forget during a pending credential write cannot resurrect a saved session", async () => {
  await enable();
  let started, release;
  const began = new Promise(resolve => { started = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  let once = true;
  globalThis.__secureStorageFault = async operation => {
    if (operation === "set" && once) { once = false; started(); await blocked; }
  };
  const pending = connection.connectAiCoach("https://other.example.com", "different-owner-token-" + "x".repeat(32));
  const rejected = assert.rejects(pending);
  await began;
  const forgotten = connection.disconnectAiCoach();
  release();
  await rejected; await forgotten;
  delete globalThis.__secureStorageFault;
  assert.equal(secureStorage.size, 0);
  assert.equal((await connection.readAiConnection()).connected, false);
});
test("large context is capped and reports truncation instead of claiming full history", async () => {
  const ctx = await context();
  for (let i = 0; i < 170; i++) await request(`/api/workouts/${ctx.focus.workoutId}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8 });
  const bounded = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: ctx.focus.workoutId });
  assert.equal(bounded.sessions.flatMap(s => s.sets).length, 160);
  assert.equal(bounded.truncated, true);
});
