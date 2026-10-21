import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";

const { exportProgress, parseProgressBackup, restoreProgress } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { startTimer, pauseTimer, extendTimer } = await import("../lib/trainingCoach.ts");
const { makeWorkoutDraft, retryDraftAction } = await import("../lib/workoutDraft.ts");

beforeEach(() => { storage.clear(); globalThis.__storageFault = undefined; });
const bench = { exerciseId: 1, weightKg: 37.5, reps: 8, rir: 2, technique: "good" };
const plank = { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45, rir: null, technique: null };
const url = id => `/api/workouts/${id}/draft`;
const create = () => request("/api/workouts", "POST", {});
const save = (id, draft, revision = 0) => request(url(id), "PUT", { draft, revision });
const commit = (id, revision) => request(url(id) + "/commit", "POST", { revision });
const transfer = (id, timer, revision = 0) => request(url(id) + "/transfer", "POST", { timer, revision });
const failWrite = phase => {
  globalThis.__storageFault = event => {
    if (event.operation === "setItem" && event.key === PROGRESS_KEY && event.phase === phase) {
      globalThis.__storageFault = undefined;
      throw new Error("Draft storage interruption");
    }
  };
};
const resign = value => JSON.stringify({ ...value, checksum: createHash("sha256").update(JSON.stringify({ state: value.state, plans: value.plans })).digest("hex") });

test("draft persists all confirmed fields and round-trips without inventing a performed set", async () => {
  const workout = await create();
  assert.deepEqual(await request(url(workout.id)), { draft: null, revision: 0 });
  const saved = await save(workout.id, bench);
  assert.deepEqual(saved, { draft: bench, revision: 1 });
  const stats = await request("/api/stats/overview");
  assert.equal(stats.totalWorkouts, 0);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 0);
  assert.equal((await request("/api/levels")).currentLevel, 0);
  const backup = await exportProgress();
  assert.equal(JSON.parse(backup).version, 10);
  await save(workout.id, plank, 1);
  await restoreProgress(backup);
  assert.deepEqual(await request(url(workout.id)), saved);
});

test("invalid units, references and stale draft versions never overwrite confirmed input", async () => {
  const workout = await create();
  await save(workout.id, bench);
  const before = storage.get(PROGRESS_KEY);
  for (const draft of [
    { ...bench, weightKg: 2.5 }, { ...bench, weightKg: -1 }, { ...bench, reps: 1.5 },
    { ...bench, reps: 0 }, { ...bench, durationSeconds: 30 },
    { ...plank, rir: 2 }, { ...plank, weightKg: 20 }, { ...plank, durationSeconds: 0 },
    { ...plank, durationSeconds: 30.5 }, { ...plank, durationSeconds: 86401 },
    { ...bench, exerciseId: 999 }, { ...bench, technique: "maybe" },
  ]) {
    await assert.rejects(save(workout.id, draft, 1), { status: 400 });
    assert.equal(storage.get(PROGRESS_KEY), before);
  }
  await assert.rejects(save(workout.id, plank, 0), { status: 409 });
  for (const revision of [null, "1", -1, 1.5]) await assert.rejects(save(workout.id, plank, revision), { status: 400 });
  await assert.rejects(request(url(workout.id), "PUT", { draft: plank }), { status: 400 });
  assert.equal(storage.get(PROGRESS_KEY), before);
});

test("plank transfer saves elapsed seconds and clears the timer in the same state write", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 14) });
  try {
    const workout = await create();
    const timer = pauseTimer(startTimer("plank", 60, 30, Date.now() - 37000));
    await request(`/api/workouts/${workout.id}/timer`, "PUT", timer);
    const result = await transfer(workout.id, timer);
    assert.equal(result.timer, null);
    assert.equal(result.draft.durationSeconds, 37);
    assert.equal(result.draft.exerciseId, 30);
    assert.equal(result.draft.weightKg, 0);
    assert.equal(result.draft.reps, 0);
    const backup = await exportProgress();
    await restoreProgress(backup);
    assert.deepEqual(await request(url(workout.id)), { draft: result.draft, revision: result.revision });
    assert.equal((await request(`/api/workouts/${workout.id}/timer`)).timer, null);
    assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 0);
    assert.deepEqual(await transfer(workout.id, timer), result);
  } finally { context.mock.timers.reset(); }
});

for (const phase of ["before", "after"]) test(`transfer retry is lossless after a ${phase}-write interruption`, async () => {
  const workout = await create();
  await save(workout.id, bench);
  const timer = pauseTimer(startTimer("plank", 60, 30, Date.now() - 20000));
  await request(`/api/workouts/${workout.id}/timer`, "PUT", timer);
  failWrite(phase);
  await assert.rejects(transfer(workout.id, timer, 1), /interruption/);
  const stored = await request(url(workout.id));
  const live = (await request(`/api/workouts/${workout.id}/timer`)).timer;
  if (phase === "before") { assert.deepEqual(stored.draft, bench); assert.deepEqual(live, timer); }
  else { assert.equal(stored.draft.durationSeconds, 20); assert.equal(live, null); }
  const result = await transfer(workout.id, timer, 1);
  assert.equal(result.draft.durationSeconds, 20);
  assert.equal(result.revision, 2);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 0);
});

test("a stale transfer cannot clear a replaced timer or replace a newer draft", async () => {
  const workout = await create();
  const old = pauseTimer(startTimer("plank", 60, 30, Date.now() - 5000));
  const newer = extendTimer(old, 30);
  await request(`/api/workouts/${workout.id}/timer`, "PUT", newer);
  const before = storage.get(PROGRESS_KEY);
  await assert.rejects(transfer(workout.id, old), { status: 409 });
  assert.equal(storage.get(PROGRESS_KEY), before);
  await save(workout.id, bench);
  await assert.rejects(transfer(workout.id, newer), { status: 409 });
  assert.deepEqual((await request(`/api/workouts/${workout.id}/timer`)).timer, newer);
});

test("one draft confirmation creates one set, retains chosen ratings and safely replays", async () => {
  const workout = await create();
  const saved = await save(workout.id, bench);
  const [first, repeated] = await Promise.all([commit(workout.id, saved.revision), commit(workout.id, saved.revision)]);
  assert.equal(first.set.id, repeated.set.id);
  assert.equal(first.set.rir, 2);
  assert.equal(first.set.technique, "good");
  assert.deepEqual(first.draft, bench);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 1);
  const next = await commit(workout.id, first.revision);
  assert.notEqual(next.set.id, first.set.id);
  assert.equal(next.set.rir, 2);
  assert.equal(next.set.technique, "good");
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 2);
});

for (const phase of ["before", "after"]) test(`idempotent commit retries a ${phase}-write interruption without duplicate approaches`, async () => {
  const workout = await create();
  await save(workout.id, bench);
  failWrite(phase);
  const result = await retryDraftAction(() => commit(workout.id, 1));
  assert.equal(result.set.id, 1);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 1);
  assert.deepEqual((await request(url(workout.id))).draft, bench);
});

test("retry helper never repeats validation/conflict errors", async () => {
  let calls = 0;
  await assert.rejects(retryDraftAction(async () => { calls++; throw Object.assign(new Error("Conflict"), { status: 409 }); }), { status: 409 });
  assert.equal(calls, 1);
});

test("next planned target is persisted together with the performed set", async () => {
  const program = await request("/api/programs", "POST", { name: "Draft plan", exercises: [
    { exerciseId: 1, sets: 2, repsMin: 8, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg: 20, reps: 10 }, { weightKg: 22.5, reps: 8 }] },
    { exerciseId: 30, sets: 1, repsMin: 45, repsMax: 45, intent: "accessory", setTargets: [{ weightKg: 0, reps: 0, durationSeconds: 45 }] },
  ] });
  const workout = await request("/api/workouts", "POST", { programId: program.id });
  await save(workout.id, { ...bench, weightKg: 20, reps: 10 });
  let result = await commit(workout.id, 1);
  assert.equal(result.draft.weightKg, 22.5);
  assert.equal(result.draft.reps, 8);
  assert.equal(result.draft.rir, 2);
  assert.equal(result.draft.technique, "good");
  await restoreProgress(await exportProgress());
  assert.deepEqual(await request(url(workout.id)), { draft: result.draft, revision: result.revision });
  result = await commit(workout.id, result.revision);
  assert.deepEqual(result.draft, plank);
});

test("deleting an exercise, set or workout cannot leave broken draft references", async () => {
  const custom = await request("/api/exercises", "POST", { name: "Custom", muscleGroup: "Back", equipment: "dumbbell" });
  const workout = await create();
  await save(workout.id, { ...bench, exerciseId: custom.id, weightKg: 10 });
  await request(`/api/exercises/${custom.id}`, "PATCH", { equipment: "barbell" });
  await assert.rejects(commit(workout.id, 1), { status: 409 });
  const result = await commit(workout.id, 2);
  await request(`/api/sets/${result.set.id}`, "DELETE");
  await assert.rejects(commit(workout.id, 1), { status: 409 });
  await request(`/api/exercises/${custom.id}`, "DELETE");
  assert.equal((await request(url(workout.id))).draft, null);
  await parseProgressBackup(await exportProgress());
  await request(`/api/workouts/${workout.id}`, "DELETE");
  await assert.rejects(request(url(workout.id)), { status: 404 });
  await parseProgressBackup(await exportProgress());
});

test("finish atomically removes drafts and blocks delayed form writes", async () => {
  const workout = await create();
  await save(workout.id, bench);
  await commit(workout.id, 1);
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.deepEqual(await request(url(workout.id)), { draft: null, revision: 0 });
  await assert.rejects(save(workout.id, bench, 2), { status: 409 });
  await assert.rejects(commit(workout.id, 1), { status: 409 });
  await parseProgressBackup(await exportProgress());
});

test("checksummed invalid draft relations cannot replace progress", async () => {
  const workout = await create();
  await save(workout.id, bench);
  await commit(workout.id, 1);
  const good = JSON.parse(await exportProgress());
  const before = storage.get(PROGRESS_KEY);
  for (const change of [
    value => { value.state.workouts[0].draft.exerciseId = 999; },
    value => { value.state.workouts[0].draft.weightKg = 2.5; },
    value => { value.state.workouts[0].finishedAt = new Date().toISOString(); },
    value => { value.state.workouts[0].lastDraftCommit.setId = 999; },
    value => { value.state.workouts[0].draftRevision = 0; },
  ]) {
    const value = structuredClone(good); change(value);
    await assert.rejects(restoreProgress(resign(value)));
    assert.equal(storage.get(PROGRESS_KEY), before);
  }
});

test("version 5 backups without drafts remain compatible; existing weight controls need no migration", async () => {
  await request("/api/profile");
  const value = JSON.parse(await exportProgress());
  value.version = 5;
  await restoreProgress(JSON.stringify(value));
  const workout = await create();
  assert.deepEqual(await request(url(workout.id)), { draft: null, revision: 0 });
  assert.equal(makeWorkoutDraft({ id: 1, name: "Bench", equipment: "barbell" }).weightKg, 20);
  assert.equal(makeWorkoutDraft({ id: 3, name: "Dumbbell", equipment: "dumbbell" }).weightKg, 10);
});
