import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, estimateStrength, epleyWithRir, strongestMeasurement, goalPrescription } from "@workspace/ai-coach";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { buildNextExercisePrediction, buildActivePrediction } = await import("../lib/trainingPrediction.ts");
const { buildExerciseOutlook } = await import("../lib/exerciseOutlook.ts");
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { buildTrainingAnalysis } = await import("../lib/trainingAnalysis.ts");
const { nextWorkingLoad } = await import("../lib/trainingCoach.ts");
const now = Date.parse("2026-10-28T12:00:00Z");
beforeEach(() => storage.clear());
async function seed() {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  return JSON.parse(storage.get(PROGRESS_KEY));
}
function session(state, id, exerciseId, sets, day = 10 + id) {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  const workout = { id, name: null, startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z` };
  state.workouts.push(workout); state.nextWorkoutId = Math.max(state.nextWorkoutId, id + 1);
  for (const [i, [weightKg, reps, rir, technique = "good"]] of sets.entries()) state.sets.push({ id: state.nextSetId++, exerciseId, workoutId: id, weightKg, reps, rir, technique, createdAt: `${date}T10:${String(i * 3).padStart(2, "0")}:00Z` });
  return state.sets.filter(s => s.workoutId === id).map(s => ({ ...s, workoutStartedAt: workout.startedAt, workoutFinishedAt: workout.finishedAt }));
}
const triple = (weight, reps = 8, rir = 2) => Array.from({ length: 3 }, () => [weight, reps, rir]);

test("a later top set, not a lighter ramp-up, represents the session exactly once", async () => {
  const raw = await seed();
  const rows = session(raw, 1, 1, [[50, 10, 2], [60, 8, 0], [60, 8, 0]]);
  const before = structuredClone(rows), estimate = estimateStrength(rows, now);
  assert.equal(strongestMeasurement(rows), rows[1]);
  assert.equal(estimate.estimated1RMKg, 76); assert.equal(estimate.sessions, 1);
  assert.deepEqual(rows, before);
  assert.equal(strongestMeasurement(rows.map(s => ({ ...s, technique: "breakdown" }))), undefined);
});

test("incline 60 x 8 at RIR zero is counted, with an explicit RIR-two load conversion, not an invented increase", async () => {
  const raw = await seed();
  raw.exercises.find(e => e.id === 1).name = "Жим штанги в наклоне";
  session(raw, 1, 1, triple(50, 10, 2));
  session(raw, 2, 1, [[50, 10, 2], [60, 8, 0], [60, 8, 0]], 27);
  const before = structuredClone(raw), prediction = buildNextExercisePrediction(raw, 1, now);
  assert.equal(prediction.model.estimated1RMKg, 76);
  assert.equal(prediction.next.weightKg, 55); assert.equal(prediction.next.reps, 8);
  assert.match(prediction.next.reason, /60 кг × 8, запас 0/); assert.match(prediction.next.reason, /запас 2/);
  const outlook = buildExerciseOutlook(raw, 1, new Date(now));
  assert.equal(outlook.lastPerformance.weightKg, 60); assert.equal(outlook.lastPerformance.rir, 0);
  assert.equal(outlook.initialWeightKg, 55); assert.deepEqual(raw, before);
});

test("rapid improvements in barbell, dumbbell and machine loads immediately replace stale lower EMA prescriptions", async () => {
  for (const [exerciseId, oldWeight, newWeight] of [[1, 40, 60], [3, 10, 25], [14, 50, 100]]) {
    const raw = await seed();
    for (let id = 1; id <= 3; id++) session(raw, id, exerciseId, triple(oldWeight));
    session(raw, 4, exerciseId, [[oldWeight, 8, 2], ...triple(newWeight)], 27);
    const prediction = buildNextExercisePrediction(raw, exerciseId, now);
    assert.equal(prediction.next.weightKg, newWeight);
    assert.ok(Math.abs(prediction.model.estimated1RMKg - epleyWithRir(newWeight, 8, 2)) < 1e-8);
    assert.equal(prediction.next.action, "hold");
  }
});

test("live ramp-up is superseded by a newly completed heavier quality set, but failure still reduces subsequent work", async () => {
  const raw = await seed();
  session(raw, 1, 1, [[40, 8, 2], [60, 8, 2]]);
  raw.workouts[0].finishedAt = null;
  const prediction = buildActivePrediction(raw, 1, 1, now);
  assert.equal(prediction.model.estimated1RMKg, 80); assert.equal(prediction.next.weightKg, 60);
  raw.sets.at(-1).rir = 0;
  const failure = buildActivePrediction(raw, 1, 1, now);
  assert.ok(failure.next.weightKg < 60); assert.match(failure.next.reason, /Последний подход тяжелее/);
});

test("a fresh weaker session and technique breakdown cannot be overruled by old stronger history", async () => {
  const raw = await seed();
  session(raw, 1, 1, triple(100)); session(raw, 2, 1, triple(50), 27);
  assert.equal(buildNextExercisePrediction(raw, 1, now).next.weightKg, 50);
  raw.sets.at(-1).technique = "breakdown";
  const p = buildNextExercisePrediction(raw, 1, now);
  assert.equal(p.next.action, "reduce"); assert.ok(p.next.weightKg < 50);
});

test("single attempts, broken-technique and unassessed high loads never become stronger formula anchors", async () => {
  const raw = await seed();
  const rows = session(raw, 1, 1, [[50, 8, 2], [150, 1, 0], [200, 8, null], [250, 8, 2, "breakdown"]]);
  assert.equal(strongestMeasurement(rows).weightKg, 50);
  assert.ok(Math.abs(estimateStrength(rows, now).estimated1RMKg - epleyWithRir(50, 8, 2)) < 1e-8);
});

test("a complete clearly easy session can add one weight step below the repetition ceiling", async () => {
  const raw = await seed(); session(raw, 1, 23, triple(20, 10, 0));
  session(raw, 2, 23, triple(20, 10, 5), 27);
  const p = buildNextExercisePrediction(raw, 23, now);
  assert.equal(p.next.weightKg, 22.5); assert.equal(p.next.reps, 10); assert.equal(p.next.action, "increase");
  assert.equal(p.model.predictedReps, null, "RIR five is not a precise 1RM measurement");
  assert.match(p.next.reason, /не ожидая верха диапазона/);
  assert.equal(buildTrainingAnalysis(raw, undefined, new Date(now)).exercises[0].next.weightKg, 22.5);
});

test("a heavier high-reserve set cannot be capped by a lighter formula-valid ramp-up from the same day", async () => {
  const raw = await seed(); session(raw, 1, 1, [[40, 8, 2], [60, 8, 5], [60, 8, 5]], 27);
  const p = buildNextExercisePrediction(raw, 1, now);
  assert.equal(p.next.weightKg, 60); assert.ok(p.next.reps > 8);
  assert.equal(p.model.predictedReps, null); assert.notEqual(p.model.status, "ready");
});

test("a stronger high-repetition working set outside the formula domain is not capped by a lighter ramp-up estimate", async () => {
  const raw = await seed(); session(raw, 1, 1, [[40, 8, 2], [60, 12, 2], [60, 12, 2]], 27);
  const p = buildNextExercisePrediction(raw, 1, now);
  assert.equal(p.next.weightKg, 60); assert.equal(p.next.reps, 12);
  assert.equal(p.model.predictedReps, null); assert.equal(p.model.status, "insufficient");
});

test("easy-session acceleration requires full comparable sets, complete feedback and a feasible equipment step", async () => {
  const raw = await seed(), rows = session(raw, 1, 1, triple(50, 8, 5), 27);
  const goal = { ...goalPrescription("hypertrophy", raw.exercises[0]), sets: 3, exerciseId: 1, equipment: "barbell", weightStepKg: 2.5 };
  for (const blocked of [rows.slice(1), rows.map(s => ({ ...s, rir: null })), rows.map(s => ({ ...s, technique: null })), [rows[0], rows[1], { ...rows[2], rir: 0 }], [rows[0], rows[1], { ...rows[2], weightKg: 55 }]]) {
    assert.equal(nextWorkingLoad(blocked, goal, now).increase, false);
  }
  assert.equal(nextWorkingLoad(rows, { ...goal, weightStepKg: 10 }, now).increase, false);
  assert.equal(nextWorkingLoad(rows, { ...goal, equipment: "bodyweight" }, now).increase, false);
});

test("a quickly progressing diary keeps up with all six measured load jumps without inventing extra ones", async () => {
  const raw = await seed();
  for (let id = 1; id <= 6; id++) {
    const weight = 40 + id * 5;
    session(raw, id, 1, [[weight - 10, 8, 2], ...triple(weight)], 5 + id * 3);
    const p = buildNextExercisePrediction(raw, 1, now);
    assert.equal(p.next.weightKg, weight); assert.notEqual(p.next.action, "increase");
    assert.ok(p.next.reps >= 8 && p.next.reps <= 12);
  }
});

test("forecast, daily plan and review use the same new working target without mutating history", async () => {
  const raw = await seed(); session(raw, 1, 1, triple(40));
  session(raw, 2, 1, [[40, 8, 2], ...triple(60)], 27);
  const before = structuredClone(raw), daily = buildDailyWorkout(raw, new Date(now), "push");
  const exercise = daily.plan.exercises.find(e => e.exerciseId === 1);
  const outlook = buildExerciseOutlook(raw, 1, new Date(now));
  const review = buildTrainingAnalysis(raw, undefined, new Date(now)).exercises.find(e => e.exerciseId === 1);
  assert.equal(exercise.setTargets[0].weightKg, 60);
  assert.equal(outlook.initialWeightKg, 60); assert.equal(review.next.weightKg, 60);
  assert.deepEqual(raw, before);
});
