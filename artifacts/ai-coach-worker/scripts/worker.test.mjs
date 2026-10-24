import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare, Log, LogLevel, convertV4MiniflareOptions } from "miniflare";
import { defaultCoachProfile, coachContextSchema } from "@workspace/ai-coach";

const bundle = await build({ entryPoints: ["src/index.ts"], bundle: true, write: false, format: "esm", platform: "browser", target: "es2022", external: ["node:*"] });
const token = "test-worker-private-owner-token-1234567890123456789";
const seed = { month: new Date().toISOString().slice(0, 7), usedNanoUsd: 10_000_000, reservedNanoUsd: 0 };
const context = () => ({ version: 1, task: "review", preferences: defaultCoachProfile(), athlete: { sex: null, bodyWeightKg: null }, catalog: [], sessions: [], focus: { workoutId: 1, finished: true, draftRevision: 0, draft: null }, programs: [], truncated: false });
const answer = { summary: "Mock provider only, no OpenAI calls", cautions: [], nextSet: null, plan: null };
const hash = text => createHash("sha256").update(text).digest("hex");

test("workerd accepts the prepared workout contract and returns locally calibrated loads, including cache hits", async () => {
  const ctx = context(); ctx.task = "next_workout"; ctx.focus = null; ctx.loadSelection = "calibration-v1";
  ctx.catalog = [{ id: 1, name: "Bench", muscleGroup: "Chest", equipment: "barbell", timed: false }, { id: 3, name: "DB bench", muscleGroup: "Chest", equipment: "dumbbell", timed: false }];
  const plan = { name: "Prepared", description: "Daily model", exercises: [{ exerciseId: 3, reason: "Assess first set", targets: [{ weightKg: 17.5, reps: 8, durationSeconds: null }] }] };
  ctx.preparedWorkout = plan;
  ctx.calibrationEstimates = [{ exerciseId: 3, sourceExerciseId: 1, coefficient: 0.3, weightKg: 17.5, reps: 8, reason: "Conservative heuristic" }];
  ctx.loadTargets = [{ exerciseId: 3, targets: plan.exercises[0].targets, calibration: true, reason: "Local model" }];
  const canonical = coachContextSchema.parse(ctx);
  const f = fixture({ provider: body => {
    assert.deepEqual(JSON.parse(body.input).context.preparedWorkout, plan);
    assert.ok(body.instructions.includes("preparedWorkout"));
    return { ...answer, plan: { ...plan, exercises: [{ ...plan.exercises[0], targets: [{ weightKg: 2.5, reps: 12, durationSeconds: null }] }] } };
  } });
  try {
    for (const id of ["prepared-workerd-0001", "prepared-workerd-0002"]) {
      const response = await f.call(id, canonical); assert.equal(response.status, 200);
      const result = await response.json(); assert.equal(result.result.plan.exercises[0].targets[0].weightKg, 17.5);
      assert.equal(result.result.plan.exercises[0].targets[0].reps, 8);
    }
    assert.equal(f.calls(), 1);
  } finally { await f.mf.dispose(); }
});
function fixture({ initial = seed, key = "sk-fake-workerd-only", root, provider } = {}) {
  let calls = 0;
  const mf = new Miniflare({ ...convertV4MiniflareOptions({
    name: "worker-test", script: bundle.outputFiles[0].text, modules: true,
    compatibilityDate: "2026-10-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { COACH: { className: "CoachObject", useSQLite: true } },
    bindings: { AI_COACH_OWNER_TOKEN: token, OPENAI_API_KEY: key, AI_COACH_MONTHLY_LIMIT_USD: "5", ...(initial ? { INITIAL_BUDGET_JSON: JSON.stringify(initial) } : {}) },
    log: new Log(LogLevel.NONE),
    outboundService: async request => {
      calls++;
      assert.equal(request.url, "https://api.openai.com/v1/responses");
      assert.equal(request.headers.get("authorization"), "Bearer sk-fake-workerd-only");
      const body = await request.json(); assert.equal(body.store, false); assert.equal(body.service_tier, "default");
      const payload = provider ? await provider(body) : answer;
      if (payload instanceof Response) return payload;
      return new Response(JSON.stringify({ id: "resp_mock", object: "response", status: "completed", output: [{ type: "message", id: "msg_mock", role: "assistant", status: "completed", content: [{ type: "output_text", text: typeof payload === "string" ? payload : JSON.stringify(payload), annotations: [] }] }], usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 } }), { headers: { "Content-Type": "application/json" } });
    },
  }), ...(root ? { resourcePersistencePath: resolve(root) } : {}) });
  const request = (path, options = {}) => mf.dispatchFetch(`https://coach.test${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers } });
  const call = (id, ctx = context(), fingerprint = hash(JSON.stringify(ctx))) => request("/v1/coach", { method: "POST", body: JSON.stringify({ id, context: ctx, fingerprint }) });
  return { mf, request, call, calls: () => calls };
}

test("workerd serves structured review sections, caches them and retains the same durable spend ledger", async () => {
  const rich = { ...answer, review: { overview: "Insufficient history", progress: [], workload: "No sets logged", effort: "Feedback missing", priorities: [{ title: "Log", action: "Record actual work", reason: "No observations" }], limitations: ["Recovery unknown"] } };
  const f = fixture({ provider: body => {
    assert.equal(body.text.format.name, "gymbeam_review"); assert.equal(body.max_output_tokens, 4800);
    assert.ok(body.text.format.schema.required.includes("review"));
    return rich;
  } });
  try {
    const ctx = context();
    const totals = { workouts: 1, sets: 0, reps: 0, seconds: 0, repSets: 0, rirKnown: 0, techniqueKnown: 0, failureSets: 0, breakdownSets: 0, rirBuckets: [0, 0, 0, 0, 0, 0, 0] };
    ctx.analysis = { version: 1, asOf: "2026-10-21", from: "2026-09-24", totals, focus: { workoutId: 1, totals }, groups: [], exercises: [], omittedExercises: 0, limitations: ["No data"] };
    for (const id of ["review-worker-00001", "review-worker-00002"]) {
      const response = await f.call(id, ctx); assert.equal(response.status, 200);
      const result = await response.json(); assert.deepEqual(result.result, rich);
      assert.equal(result.budget.usedUsd, 0.01015); assert.equal(result.budget.reservedUsd, 0);
    }
    assert.equal(f.calls(), 1);
  } finally { await f.mf.dispose(); }
});

test("workerd preserves the local math decision and does not call the provider again for its cache hit", async () => {
  const ctx = context(); ctx.task = "next_set"; ctx.focus.finished = false;
  ctx.catalog = [{ id: 1, name: "Bench", muscleGroup: "Chest", equipment: "barbell", timed: false }];
  ctx.focus.draft = { exerciseId: 1, weightKg: 70, reps: 8, durationSeconds: null, rir: 2, technique: "good" };
  ctx.sessions = [{ id: 1, finishedAt: null, sets: [ctx.focus.draft] }];
  ctx.nextSetTarget = { exerciseId: 1, weightKg: 70, reps: 8, action: "hold", reason: "Local controller", model: { version: "epley-rir-ema-v1", status: "ready", estimated1RMKg: 93.333, sessions: 0, targetRir: 2, source: "today", validationSamples: 0, repErrorMAE: null, rirErrorMAE: null, fatigueBeta: null, fatigueSamples: 0, unroundedWeightKg: 70, predictedReps: 8, targets: [{ weightKg: 70, reps: 8 }], note: "Estimate" } };
  const canonical = coachContextSchema.parse(ctx);
  const f = fixture({ provider: body => {
    assert.ok(body.instructions.includes("Use nextSetTarget verbatim"));
    return { ...answer, nextSet: { exerciseId: 1, weightKg: 500, reps: 30, durationSeconds: null, reason: "Untrusted numeric suggestion" } };
  } });
  try {
    for (const id of ["math-workerd-00001", "math-workerd-00002"]) {
      const response = await f.call(id, canonical); assert.equal(response.status, 200);
      const result = await response.json(); assert.equal(result.result.nextSet.weightKg, 70); assert.equal(result.result.nextSet.reps, 8);
    }
    assert.equal(f.calls(), 1);
  } finally { await f.mf.dispose(); }
});

test("workerd authenticates before parsing and fails closed until budget/key are configured", async () => {
  const f = fixture({ key: "" });
  try {
    assert.equal((await f.mf.dispatchFetch("https://coach.test/healthz")).status, 200);
    assert.equal((await f.mf.dispatchFetch("https://coach.test/v1/coach", { method: "POST", body: "not JSON" })).status, 401);
    const status = await f.request("/v1/coach/status").then(r => r.json());
    assert.equal(status.ready, false); assert.equal(status.budget.usedUsd, 0.01);
    assert.equal((await f.call("request-no-key-0001")).status, 503);
    assert.equal(f.calls(), 0);
  } finally { await f.mf.dispose(); }
  const unseeded = fixture({ initial: null });
  try { assert.equal((await unseeded.call("request-no-seed-001")).status, 503); assert.equal(unseeded.calls(), 0); }
  finally { await unseeded.mf.dispose(); }
});
test("workerd supports bounded active-workout messages and passes versioned research to provider", async () => {
  const f = fixture({ provider: body => {
    const input = JSON.parse(body.input);
    assert.equal(input.context.messages[0].text, "Тренажёр занят");
    assert.equal(input.research.version, "acsm-2026-iusca-2021-progression-v3");
    assert.ok(input.research.sources.some(source => source.url === "https://doi.org/10.47206/ijsc.v1i1.81"));
    return answer;
  } });
  try {
    const ctx = context(); ctx.task = "adjust_workout"; ctx.focus.finished = false;
    ctx.messages = [{ role: "user", text: "Тренажёр занят" }]; ctx.remainingPlan = [];
    assert.equal((await f.call("dialogue-worker-0001", ctx)).status, 200);
    ctx.messages[0].text = "x".repeat(301);
    assert.equal((await f.call("dialogue-worker-0002", ctx)).status, 400);
    assert.equal(f.calls(), 1);
  } finally { await f.mf.dispose(); }
});
test("workerd validates and settles the separate monthly response format", async () => {
  const f = fixture({ provider: body => {
    assert.equal(body.max_output_tokens, 6000);
    assert.ok(body.text.format.schema.properties.monthly);
    return { ...answer, monthly: { name: "Month", overview: "Four weeks", daysPerWeek: 3, templates: [{ name: "Core", description: "Core session", exercises: [{ exerciseId: 30, reason: "Core", targets: [{ weightKg: 0, reps: 0, durationSeconds: 30 }] }] }], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Consistency", sessions: [0, 0, 0] })) } };
  } });
  try {
    const ctx = context(); ctx.task = "month_plan";
    ctx.catalog = [{ id: 30, name: "Планка", muscleGroup: "Пресс", equipment: "bodyweight", timed: true }];
    const response = await f.call("monthly-worker-0001", ctx); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.result.monthly.weeks.length, 4);
    assert.equal(result.budget.reservedUsd, 0);
    assert.equal(f.calls(), 1);
  } finally { await f.mf.dispose(); }
});

test("workerd preserves carried spend, settles usage, caches, and rejects changed request IDs", async () => {
  const f = fixture();
  try {
    assert.equal((await f.call("request-success-001")).status, 200);
    const repeated = await f.call("request-success-002").then(r => r.json());
    assert.deepEqual(repeated.result, answer); assert.equal(f.calls(), 1);
    assert.equal(repeated.budget.usedUsd, 0.01015); assert.equal(repeated.budget.reservedUsd, 0);
    const changed = context(); changed.preferences.daysPerWeek = 4;
    assert.equal((await f.call("request-success-001", changed)).status, 409);
  } finally { await f.mf.dispose(); }
});

test("workerd refuses spend before calling OpenAI when the carried budget is exhausted", async () => {
  const f = fixture({ initial: { ...seed, usedNanoUsd: 4_999_999_999 } });
  try { assert.equal((await f.call("request-budget-0001")).status, 402); assert.equal(f.calls(), 0); }
  finally { await f.mf.dispose(); }
});

test("workerd bounds request bodies and validates context hashes before inference", async () => {
  const f = fixture();
  try {
    assert.equal((await f.request("/v1/coach", { method: "POST", body: "not JSON" })).status, 400);
    assert.equal((await f.request("/v1/coach", { method: "POST", body: "x".repeat(65537) })).status, 413);
    assert.equal((await f.call("request-bad-hash-01", context(), "a".repeat(64))).status, 400);
    assert.equal(f.calls(), 0);
  } finally { await f.mf.dispose(); }
});

test("workerd charges invalid model output but does not cache it or expose raw errors", async () => {
  const f = fixture({ provider: async () => "SECRET invalid JSON" });
  try {
    const response = await f.call("request-invalid-01"); assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("SECRET"));
    const status = await f.request("/v1/coach/status").then(r => r.json());
    assert.equal(status.budget.usedUsd, 0.01015); assert.equal(status.budget.reservedUsd, 0);
  } finally { await f.mf.dispose(); }
});

test("durable spend survives runtime restart and the migration cannot reset it", async () => {
  const root = mkdtempSync(join(tmpdir(), "gymbeam-do-test-"));
  let f = fixture({ root });
  try {
    assert.equal((await f.call("request-durable-01")).status, 200);
    await f.mf.dispose();
    f = fixture({ root });
    assert.equal((await f.call("request-durable-02")).status, 200); assert.equal(f.calls(), 0);
    assert.equal((await f.request("/v1/coach/status").then(r => r.json())).budget.usedUsd, 0.01015);
    await f.mf.dispose();
    f = fixture({ root, initial: { ...seed, usedNanoUsd: 0 } });
    assert.equal((await f.request("/v1/coach/status")).status, 503); assert.equal(f.calls(), 0);
  } finally {
    await f.mf.dispose();
    const resolved = resolve(root);
    assert.ok(resolved.startsWith(resolve(tmpdir()) + "\\") || resolved.startsWith(resolve(tmpdir()) + "/"));
    rmSync(resolved, { recursive: true });
  }
});

test("unknown upstream failure retains a durable reservation without automatic retries", async () => {
  const f = fixture({ provider: async () => new Response('{"error":{"message":"lost upstream"}}', { status: 500, headers: { "Content-Type": "application/json" } }) });
  try {
    assert.equal((await f.call("request-upstream-01")).status, 502); assert.equal(f.calls(), 1);
    const status = await f.request("/v1/coach/status").then(r => r.json());
    assert.equal(status.budget.usedUsd, 0.01); assert.ok(status.budget.reservedUsd > 0);
  } finally { await f.mf.dispose(); }
});

test("concurrent identical requests share a single pending reservation", async () => {
  let began;
  const started = new Promise(resolve => { began = resolve; });
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ provider: async () => { began(); await pending; return answer; } });
  try {
    const first = f.call("request-concurrent-01");
    await started;
    assert.equal((await f.call("request-concurrent-02")).status, 409);
    assert.equal(f.calls(), 1);
    finish(); assert.equal((await first).status, 200);
  } finally { finish(); await f.mf.dispose(); }
});
