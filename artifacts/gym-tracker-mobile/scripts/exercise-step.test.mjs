import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, mock, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";
const { PROGRESS_KEY, PLAN_PREFIX } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { WEIGHT_STEP_PRESETS } = await import("../lib/equipmentSettings.ts");
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const draftUrl = id => `/api/workouts/${id}/draft`;
beforeEach(() => {
  storage.clear(); globalThis.__storageFault = undefined;
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-24T10:00:00Z") });
});
afterEach(() => { mock.timers.reset(); globalThis.__storageFault = undefined; });
async function history(exerciseId = 1, weightKg = 50, reps = 12) {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  for (let n = 0; n < 2; n++) {
    const w = await request("/api/workouts", "POST");
    for (let i = 0; i < 3; i++) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId, weightKg, reps, rir: 2, technique: "good" });
    await request(`/api/workouts/${w.id}/finish`, "POST"); mock.timers.tick(1000);
  }
  const pull = await request("/api/workouts", "POST");
  await request(`/api/workouts/${pull.id}/sets`, "POST", { exerciseId: 7, weightKg: 0, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${pull.id}/finish`, "POST"); mock.timers.tick(1000);
}
async function daily() {
  await history();
  const p = await request("/api/daily-workout?split=push");
  return request("/api/daily-workout/start", "POST", { fingerprint: p.fingerprint, splitDay: "push" });
}
const bench = async id => (await loadPlan(id)).exercises.find(row => row.exerciseId === 1);

test("exercise details expose weight-step controls with shared presets, not a direct weight text field or timed kg setting", () => {
  const route = readFileSync(new URL("../app/exercises/[id].tsx", import.meta.url), "utf8");
  const control = readFileSync(new URL("../components/ExerciseWeightStep.tsx", import.meta.url), "utf8");
  assert.match(route, /!timed \? <ExerciseWeightStep/);
  assert.match(control, /<Stepper label="Шаг веса"/); assert.match(control, /invalidateQueries\(\)/);
  assert.doesNotMatch(control, /TextInput/);
  assert.ok(WEIGHT_STEP_PRESETS.includes(1.25));
  assert.ok(WEIGHT_STEP_PRESETS.every(n => n >= 0.25 && n <= 20));
});

test("changing a used barbell's step recalculates exercise/statistics forecasts and daily/AI targets while history stays exact", async () => {
  await history();
  const recorded = structuredClone(state().sets);
  const old = await request("/api/exercises/1/outlook");
  assert.equal(old.sessions[0].targets[0].weightKg, 52.5);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  assert.equal((await request("/api/stats/exercises/1/progress")).exercise.weightStepKg, 5);
  const next = await request("/api/exercises/1/outlook");
  assert.equal(next.weightStepKg, 5); assert.equal(next.sessions[0].targets[0].weightKg, 55);
  const stats = await request("/api/stats/outlook");
  assert.equal(stats.exercises.find(ex => ex.exercise.id === 1).sessions[0].targets[0].weightKg, 55);
  const p = await request("/api/daily-workout?split=push");
  assert.equal(p.plan.exercises.find(ex => ex.exerciseId === 1).setTargets[0].weightKg, 55);
  const context = await request("/api/ai-coach/context", "POST", { task: "next_workout", splitDay: "push" });
  assert.equal(context.catalog.find(ex => ex.id === 1).weightStepKg, 5);
  assert.equal(context.loadTargets.find(ex => ex.exerciseId === 1).targets[0].weightKg, 55);
  assert.deepEqual(state().sets, recorded);
});

test("a stale proposed workout cannot start after its exercise step changes", async () => {
  await history(); const old = await request("/api/daily-workout?split=push");
  await request("/api/exercises/1", "PATCH", { weightStepKg: 1.25 });
  const fresh = await request("/api/daily-workout?split=push");
  assert.notEqual(fresh.fingerprint, old.fingerprint);
  assert.equal(fresh.plan.exercises.find(ex => ex.exerciseId === 1).setTargets[0].weightKg, 51.25);
  await assert.rejects(request("/api/daily-workout/start", "POST", { fingerprint: old.fingerprint, splitDay: "push" }), { status: 409 });
});

test("step changes refresh an active daily plan and untouched draft atomically and reject old draft revisions", async () => {
  const w = await daily(), old = await request(draftUrl(w.id)), recorded = structuredClone(state().sets);
  assert.equal(old.draft.weightKg, 52.5);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  const fresh = await request(draftUrl(w.id)), plan = await bench(w.id);
  assert.equal(plan.weightStepKg, 5); assert.ok(plan.setTargets.every(set => set.weightKg === 55));
  assert.equal(fresh.draft.weightKg, 55); assert.equal(fresh.revision, old.revision + 1);
  await assert.rejects(request(draftUrl(w.id), "PUT", { revision: old.revision, draft: old.draft }), { status: 409 });
  assert.deepEqual(state().sets, recorded);
});

test("completed targets and performed sets stay unchanged while the next high-reserve target uses the new step", async () => {
  const w = await daily();
  let d = await request(draftUrl(w.id));
  d = await request(draftUrl(w.id), "PUT", { revision: d.revision, draft: { ...d.draft, rir: 5, technique: "good" } });
  await request(draftUrl(w.id) + "/commit", "POST", { revision: d.revision });
  const completed = structuredClone((await bench(w.id)).setTargets[0]), recorded = structuredClone(state().sets);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 1 });
  const plan = await bench(w.id);
  assert.deepEqual(plan.setTargets[0], completed);
  assert.equal(plan.setTargets[1].weightKg, 53.5);
  assert.equal((await request(draftUrl(w.id))).draft.weightKg, 53.5);
  assert.deepEqual(state().sets, recorded);
});

test("a manually edited draft survives the change even though automatic future targets refresh", async () => {
  const w = await daily(), d = await request(draftUrl(w.id));
  const manual = { ...d.draft, weightKg: 47.5, reps: 9, rir: 3, technique: "good" };
  await request(draftUrl(w.id), "PUT", { revision: d.revision, draft: manual });
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  assert.deepEqual((await request(draftUrl(w.id))).draft, manual);
  assert.equal((await bench(w.id)).setTargets[0].weightKg, 55);
});

test("saved manual templates retain exact numbers; an active manual plan only receives step metadata", async () => {
  const program = await request("/api/programs", "POST", { name: "Manual", exercises: [{ exerciseId: 1, sets: 2, repsMin: 8, repsMax: 12, intent: "hypertrophy", weightStepKg: 2.5, setTargets: [{ weightKg: 50, reps: 8 }, { weightKg: 45, reps: 10 }] }] });
  const w = await request("/api/workouts", "POST", { programId: program.id });
  const targets = structuredClone((await bench(w.id)).setTargets), d = await request(draftUrl(w.id)), programs = structuredClone(state().customPrograms);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  assert.equal((await bench(w.id)).weightStepKg, 5); assert.deepEqual((await bench(w.id)).setTargets, targets);
  assert.deepEqual((await request(draftUrl(w.id))).draft, d.draft);
  assert.deepEqual(state().customPrograms, programs);
});

test("a newly available microstep unlocks measured dumbbell progression, while an oversized step still cannot force a jump", async () => {
  await history(24, 5, 15);
  assert.equal((await request("/api/exercises/24/outlook")).sessions[0].targets[0].weightKg, 5);
  await request("/api/exercises/24", "PATCH", { weightStepKg: 0.5 });
  assert.equal((await request("/api/exercises/24/outlook")).sessions[0].targets[0].weightKg, 5.5);
  await request("/api/exercises/24", "PATCH", { weightStepKg: 5 });
  const held = await request("/api/exercises/24/outlook");
  assert.equal(held.sessions[0].targets[0].weightKg, 5); assert.match(held.reason, /10%/);
});

test("monthly scheduling recalculates weights from the new exercise step without rewriting the saved month", async () => {
  await history(); const raw = state();
  const plan = { name: "Month", overview: "Fixture", daysPerWeek: 3, templates: [{ name: "Bench", description: "Fixture", exercises: [{ exerciseId: 1, reason: "Fixture", targets: Array.from({ length: 3 }, () => ({ weightKg: 50, reps: 12, durationSeconds: null })) }] }], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Fixture", sessions: [0, 0, 0] })) };
  raw.coachMonth = { id: "b".repeat(64), createdAt: new Date().toISOString(), plan };
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  const month = structuredClone(raw.coachMonth);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  const preview = await request("/api/daily-workout?split=push");
  assert.equal(preview.source, "month"); assert.equal(preview.plan.exercises[0].setTargets[0].weightKg, 55);
  assert.equal((await request("/api/exercises/1/outlook")).sessions[0].targets[0].weightKg, 55);
  assert.deepEqual(state().coachMonth, month);
});

test("new step, active plan and draft survive a backup round-trip without losing history", async () => {
  const w = await daily(); await request("/api/exercises/1", "PATCH", { weightStepKg: 1.25 });
  const old = state(), plan = await loadPlan(w.id), d = await request(draftUrl(w.id));
  const copy = await exportProgress(); await restoreProgress(copy);
  assert.deepEqual(state(), old); assert.deepEqual(await loadPlan(w.id), plan); assert.deepEqual(await request(draftUrl(w.id)), d);
});

test("invalid step values and an unchanged step cannot corrupt progress or invalidate a draft unnecessarily", async () => {
  const w = await daily(), snapshot = new Map(storage), d = await request(draftUrl(w.id));
  for (const weightStepKg of [0, 0.1, 21, "5", null]) {
    await assert.rejects(request("/api/exercises/1", "PATCH", { weightStepKg }), { status: 400 });
    assert.deepEqual(storage, snapshot);
  }
  await request("/api/exercises/1", "PATCH", { weightStepKg: 2.5 });
  assert.deepEqual(await request(draftUrl(w.id)), d);
});

test("an interrupted write rolls back exercise settings, daily targets and draft together; a retry applies all three", async () => {
  const w = await daily(), old = state(), plan = await loadPlan(w.id);
  globalThis.__storageFault = event => {
    if (event.operation === "multiSet" && event.key === PLAN_PREFIX + w.id && event.phase === "after") {
      globalThis.__storageFault = undefined;
      throw new Error("Interrupted step update");
    }
  };
  await assert.rejects(request("/api/exercises/1", "PATCH", { weightStepKg: 5 }), /Interrupted/);
  assert.deepEqual(state(), old); assert.deepEqual(await loadPlan(w.id), plan);
  await request("/api/exercises/1", "PATCH", { weightStepKg: 5 });
  assert.equal(state().exercises.find(ex => ex.id === 1).weightStepKg, 5);
  assert.equal((await bench(w.id)).setTargets[0].weightKg, 55);
  assert.equal((await request(draftUrl(w.id))).draft.weightKg, 55);
});
