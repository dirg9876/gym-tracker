import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
const { respondToReserve, nextWorkingLoad } = await import("../lib/trainingCoach.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { buildNextExercisePrediction } = await import("../lib/trainingPrediction.ts");
const { buildTrainingAnalysis } = await import("../lib/trainingAnalysis.ts");
const now = Date.now();
const goal = { exerciseId: 1, equipment: "barbell", sets: 3, repsMin: 8, repsMax: 12, weightStepKg: 2.5, targetRir: 2 };
const set = (weightKg = 50, reps = 8, rir = 5, extra = {}) => ({ exerciseId: 1, workoutId: 1, weightKg, reps, rir, technique: "good", createdAt: new Date(now - 86400000).toISOString(), ...extra });
beforeEach(() => storage.clear());
async function startWithHistory() {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  const prior = await request("/api/workouts", "POST");
  for (let i = 0; i < 3; i++) await request(`/api/workouts/${prior.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${prior.id}/finish`, "POST");
  return request("/api/workouts", "POST");
}

test("a large reserve raises the next weighted target even with existing history, without inventing a high-RIR 1RM", async () => {
  const w = await startWithHistory();
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" });
  const before = new Map(storage), p = await request(`/api/workouts/${w.id}/prediction/1`);
  assert.equal(p.next.weightKg, 52.5); assert.equal(p.next.reps, 8); assert.equal(p.next.action, "increase");
  assert.equal(p.model.unroundedWeightKg, null); assert.equal(p.model.predictedReps, null);
  assert.notEqual(p.model.status, "ready"); assert.match(p.next.reason, /запас 5/);
  assert.deepEqual(storage, before);
});

test("RIR four adds a repetition before the ceiling, RIR five can add two when the weight grid is too large", () => {
  assert.equal(respondToReserve([set(50, 8, 4)], goal).reps, 9);
  const result = respondToReserve([set(5, 10, 5)], { ...goal, equipment: "dumbbell", repsMin: 10, repsMax: 15 });
  assert.equal(result.weightKg, 5); assert.equal(result.reps, 12); assert.equal(result.action, "progress_reps");
});

test("strong repeated reserve cannot compound beyond ten percent during one session", () => {
  const rows = [set()];
  for (let i = 0; i < 8; i++) {
    const p = respondToReserve(rows, goal);
    if (!p) break;
    assert.ok(p.weightKg <= 55); assert.ok(p.reps <= 12);
    rows.push(set(p.weightKg, p.reps, 5));
  }
  assert.equal(Math.max(...rows.map(s => s.weightKg)), 55);
});

test("a practical barbell quantum at twenty kg is allowed once, not repeatedly", () => {
  const rows = [set(20)], a = respondToReserve(rows, goal);
  assert.equal(a.weightKg, 22.5);
  const b = respondToReserve([...rows, set(22.5)], goal);
  assert.equal(b.weightKg, 22.5); assert.equal(b.action, "progress_reps");
});

test("bodyweight progresses repetitions only, never invents added kg, and respects the ceiling", () => {
  const g = { ...goal, equipment: "bodyweight" };
  const p = respondToReserve([set(0, 10, 5)], g);
  assert.equal(p.weightKg, 0); assert.equal(p.reps, 12);
  assert.equal(respondToReserve([set(0, 12, 5)], g), null);
});

test("missing feedback, insufficient reserve, earlier difficult sets and broken technique block the ambitious rule", () => {
  for (const last of [set(50, 8, null), set(50, 8, 3), set(50, 8, 5, { technique: null }), set(50, 8, 5, { technique: "breakdown" }), set(0, 0, 5, { durationSeconds: 40 })]) assert.equal(respondToReserve([last], goal), null);
  assert.equal(respondToReserve([set(50, 8, 1), set()], goal), null);
  assert.equal(respondToReserve([set(), set(50, 8, 5, { technique: "breakdown" }), set()], goal), null);
});

test("a full easy ceiling can confirm one step after one workout, ordinary reserve still requires two", () => {
  const rows = Array.from({ length: 3 }, () => set(50, 12, 4));
  assert.equal(nextWorkingLoad(rows, goal, now).weightKg, 52.5);
  assert.equal(nextWorkingLoad(rows.map(row => ({ ...row, rir: 2 })), goal, now).increase, false);
  assert.equal(nextWorkingLoad(rows.slice(1), goal, now).increase, false);
  assert.equal(nextWorkingLoad([...rows, set(50, 12, 4), set(50, 12, 4)], goal, now).weightKg, 52.5, "extra completed easy sets cannot invalidate an otherwise complete session");
  assert.equal(nextWorkingLoad(rows.map(row => ({ ...row, createdAt: new Date(now - 40 * 86400000).toISOString() })), goal, now).increase, false);
  assert.equal(nextWorkingLoad([set(50, 12, 0, { workoutId: 0 }), ...rows], goal, now).increase, false);
});

test("fresh targets and the workout review both give two reps after a consistently easy session", async () => {
  await request("/api/exercises");
  const raw = JSON.parse(storage.get(PROGRESS_KEY)), timestamp = new Date(now - 86400000).toISOString();
  raw.coachProfile = { ...defaultCoachProfile(), goal: "hypertrophy" };
  raw.workouts.push({ id: 1, name: null, startedAt: timestamp, finishedAt: timestamp }); raw.nextWorkoutId = 2;
  raw.sets = [set(50, 8, 4), set(50, 8, 4, { id: 2 }), set(50, 8, 4, { id: 3 })].map((s, i) => ({ ...s, id: i + 1 }));
  const p = buildNextExercisePrediction(raw, 1, now), review = buildTrainingAnalysis(raw, undefined, new Date(now));
  assert.equal(p.next.reps, 10); assert.equal(review.exercises[0].next.reps, 10);
});

test("a later heavy set lowers the target and never restores a previously ambitious weight", async () => {
  const w = await startWithHistory();
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" });
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 52.5, reps: 8, rir: 1, technique: "good" });
  const p = await request(`/api/workouts/${w.id}/prediction/1`);
  assert.equal(p.next.action, "reduce"); assert.ok(p.next.weightKg < 52.5);
});

test("the optional coach uses the same next-set goal, not an invented ambitious jump", async () => {
  const w = await startWithHistory();
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" });
  await request(`/api/workouts/${w.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" } });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: w.id });
  const response = validateCoachReply({ summary: "Goal", cautions: [], plan: null, nextSet: { exerciseId: 1, weightKg: 80, reps: 20, durationSeconds: null, reason: "Test" } }, context);
  assert.equal(response.nextSet.weightKg, 52.5); assert.equal(response.nextSet.reps, 8);
});

test("the next draft in today's plan adapts after commit and survives backup without rewriting completed targets", async () => {
  const manual = await startWithHistory();
  await request(`/api/workouts/${manual.id}/sets`, "POST", { exerciseId: 7, weightKg: 0, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${manual.id}/finish`, "POST");
  const preview = await request("/api/daily-workout?split=push");
  const w = await request("/api/daily-workout/start", "POST", { fingerprint: preview.fingerprint, splitDay: "push" });
  const plan = await loadPlan(w.id), ex = plan.exercises.find(ex => ex.exerciseId === 1);
  assert.ok(ex && ex.sets > 1 && !ex.calibration);
  const before = structuredClone(ex.setTargets[0]);
  let d = await request(`/api/workouts/${w.id}/draft`);
  d = await request(`/api/workouts/${w.id}/draft`, "PUT", { revision: d.revision, draft: { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" } });
  await request(`/api/workouts/${w.id}/draft/commit`, "POST", { revision: d.revision });
  const next = await request(`/api/workouts/${w.id}/draft`), saved = (await loadPlan(w.id)).exercises.find(ex => ex.exerciseId === 1);
  assert.equal(next.draft.weightKg, 52.5); assert.equal(next.draft.reps, 8);
  assert.equal(next.draft.rir, 5); assert.equal(next.draft.technique, "good");
  assert.deepEqual(saved.setTargets[0], before);
  const committed = new Map(storage);
  await request(`/api/workouts/${w.id}/draft/commit`, "POST", { revision: d.revision });
  assert.deepEqual(storage, committed, "retry cannot record a second set or compound the adapted target");
  const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
  const backup = await exportProgress(); await restoreProgress(backup);
  assert.equal((await request(`/api/workouts/${w.id}/draft`)).draft.weightKg, 52.5);
  assert.equal((await request(`/api/workouts/${w.id}`)).sets.at(-1).weightKg, 50);
});

test("saved literal templates and manually chosen next drafts are not silently changed by the daily adaptation", async () => {
  const program = await request("/api/programs", "POST", { name: "Literal", exercises: [{ exerciseId: 1, sets: 2, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 50, reps: 8 }, { weightKg: 45, reps: 10 }] }] });
  const w = await request("/api/workouts", "POST", { programId: program.id });
  let d = await request(`/api/workouts/${w.id}/draft`);
  d = await request(`/api/workouts/${w.id}/draft`, "PUT", { revision: d.revision, draft: { exerciseId: 1, weightKg: 50, reps: 8, rir: 5, technique: "good" } });
  await request(`/api/workouts/${w.id}/draft/commit`, "POST", { revision: d.revision });
  assert.equal((await request(`/api/workouts/${w.id}/draft`)).draft.weightKg, 45);
  assert.equal((await loadPlan(w.id)).exercises[0].setTargets[1].weightKg, 45);
});

test("assistance and timed exercises never acquire an ambitious extra-weight prescription", async () => {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  const ex = await request("/api/exercises", "POST", { name: "Assisted QA", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: ex.id, weightKg: 30, reps: 12, rir: 5, technique: "good" });
  const assisted = await request(`/api/workouts/${w.id}/prediction/${ex.id}`);
  assert.equal(assisted.next.weightKg, 30); assert.notEqual(assisted.next.action, "increase");
  for (let i = 0; i < 2; i++) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: ex.id, weightKg: 30, reps: 12, rir: 5, technique: "good" });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  const fresh = await request("/api/workouts", "POST");
  const nextAssisted = await request(`/api/workouts/${fresh.id}/prediction/${ex.id}`);
  assert.equal(nextAssisted.next.weightKg, 30); assert.notEqual(nextAssisted.next.action, "increase");
  await request(`/api/workouts/${fresh.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 40, technique: "good" });
  const timed = await request(`/api/workouts/${fresh.id}/prediction/30`);
  assert.equal(timed.model.status, "unsupported"); assert.equal(timed.next.weightKg, 0);
});
