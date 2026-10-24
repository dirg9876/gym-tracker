import assert from "node:assert/strict";
import { beforeEach, afterEach, mock, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
import { simulateCohort } from "./monthly-cohort.mjs";
const { progressionIncrement, nextWorkingLoad, workingBaseline, assessedProbe } = await import("../lib/trainingCoach.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { buildNextExercisePrediction } = await import("../lib/trainingPrediction.ts");
const { buildTrainingAnalysis } = await import("../lib/trainingAnalysis.ts");
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { buildCoachContext } = await import("../lib/aiCoachContext.ts");
const now = new Date("2026-10-24T10:00:00Z");
beforeEach(() => storage.clear());
afterEach(() => mock.timers.reset());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
async function seed(exerciseId, results, daysAgo = 2) {
  await request("/api/exercises");
  const raw = state(), date = new Date(+now - daysAgo * 86400000).toISOString(), id = raw.nextWorkoutId++;
  const ex = raw.exercises.find(row => row.id === exerciseId);
  raw.workouts.push({ id, name: null, startedAt: date, finishedAt: date });
  for (const [i, [weightKg, reps, rir = 2, technique = "good"]] of results.entries()) raw.sets.push({
    id: raw.nextSetId++, workoutId: id, exerciseId, weightKg, reps, rir, technique, equipment: ex.equipment,
    createdAt: new Date(Date.parse(date) + i * 60000).toISOString(),
  });
  raw.coachProfile = { ...defaultCoachProfile(), goal: "hypertrophy" };
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  return raw;
}
const twoSessions = (pattern, rir = 2) => [1, 2].flatMap(workoutId => pattern.map((weightKg, i) => ({ exerciseId: 1, workoutId,
  weightKg, reps: 12, rir, technique: "good", createdAt: `2026-10-${workoutId === 1 ? "20" : "22"}T10:0${i}:00Z` })));
const goal = { exerciseId: 1, equipment: "barbell", sets: 3, repsMin: 8, repsMax: 12, weightStepKg: 2.5, targetRir: 2 };

test("a 5 kg stack step can fit 100 kg but not 20 kg; high reserve allows at most two small quanta and ten percent", () => {
  assert.equal(progressionIncrement(100, 5), 5); assert.equal(progressionIncrement(50, 5), 5);
  assert.equal(progressionIncrement(20, 5), null); assert.equal(progressionIncrement(50, 2.5, true), 5);
  assert.equal(progressionIncrement(100, 1, true), 2); assert.equal(progressionIncrement(50, 2.5), 2.5);
  for (const [kg, step] of [[NaN, 1], [10, 0], [10, Infinity], [-1, 1]]) assert.equal(progressionIncrement(kg, step), null);
});

test("a small absolute dumbbell or machine quantum cannot silently become a fifty-percent routine increase", () => {
  assert.equal(progressionIncrement(5, 2.5, true, "dumbbell"), null);
  assert.equal(progressionIncrement(5, 2.5, true, "machine"), null);
  assert.equal(progressionIncrement(5, 0.5, false, "dumbbell"), 0.5);
  assert.equal(progressionIncrement(25, 2.5, false, "dumbbell"), 2.5);
  assert.equal(nextWorkingLoad(twoSessions([5, 5, 5], 4), { ...goal, equipment: "dumbbell" }, +now).increase, false);
});

test("two comparable back-off patterns can progress the primary load; one successful or mismatched pattern cannot", () => {
  const rows = twoSessions([50, 47.5, 47.5]);
  const result = nextWorkingLoad(rows, goal, +now);
  assert.equal(result.increase, true); assert.equal(result.weightKg, 52.5);
  assert.equal(nextWorkingLoad(rows.slice(3), goal, +now).increase, false);
  rows[1].weightKg = 45; assert.equal(nextWorkingLoad(rows, goal, +now).increase, false);
});

test("larger confirmed equipment steps and high-reserve acceleration never bypass missing feedback or broken technique", () => {
  assert.equal(nextWorkingLoad(twoSessions([50, 50, 50], 4), goal, +now).weightKg, 55);
  assert.equal(nextWorkingLoad(twoSessions([100, 100, 100]), { ...goal, weightStepKg: 5 }, +now).weightKg, 105);
  for (const change of [{ rir: null }, { technique: "breakdown" }, { rir: 0 }]) {
    const rows = twoSessions([50, 50, 50], 4); Object.assign(rows[0], change);
    assert.equal(nextWorkingLoad(rows, goal, +now).increase, false);
  }
});

test("the fresh-session baseline excludes back-off fatigue while preserving an assessed heavier calibration load", () => {
  const rows = [{ workoutId: 1, weightKg: 60, reps: 10 }, { workoutId: 1, weightKg: 50, reps: 10 }];
  assert.equal(workingBaseline(rows, [], 8).weightKg, 60);
  assert.equal(workingBaseline([], rows, 8).weightKg, 50);
  assert.equal(workingBaseline([{ workoutId: 1, weightKg: 20, reps: 8 }, { workoutId: 1, weightKg: 22.5, reps: 8 }], [], 8).weightKg, 22.5);
});

test("fresh-session repetition progression also starts at the primary set, not the last fatigued back-off", async () => {
  const raw = await seed(1, [[60, 10, 3], [50, 8, 3], [50, 8, 3]]);
  const prediction = buildNextExercisePrediction(raw, 1, +now);
  assert.equal(prediction.next.weightKg, 60); assert.equal(prediction.next.reps, 11);
});

test("completed isolation probes do not reset to 2.5 kg or eight reps; unknown feedback and heavy singles stay untrusted", async () => {
  const raw = await seed(24, [[5, 8, 5], [5, 8, 5]]), before = structuredClone(raw);
  const prediction = buildNextExercisePrediction(raw, 24, +now);
  assert.equal(prediction.next.weightKg, 5); assert.equal(prediction.next.reps, 10);
  const analysis = buildTrainingAnalysis(raw, undefined, now).exercises.find(row => row.exerciseId === 24);
  assert.equal(analysis.next.weightKg, 5); assert.equal(analysis.next.reps, 10);
  assert.equal(assessedProbe({ weightKg: 5, reps: 8, rir: null, technique: "good" }, 10, 2, false), null);
  assert.equal(assessedProbe({ weightKg: 100, reps: 1, rir: 3, technique: "good" }, 8, 2, false), null);
  assert.deepEqual(raw, before);
});

test("assessed short bodyweight practice is remembered in the daily plan, AI load targets and gateway validation", async () => {
  mock.timers.enable({ apis: ["Date"], now: +now });
  const raw = await seed(7, [[0, 4, 3], [0, 4, 3]]);
  const prediction = buildNextExercisePrediction(raw, 7, +now);
  assert.equal(prediction.next.weightKg, 0); assert.equal(prediction.next.reps, 5);
  const plan = buildDailyWorkout(raw, now, "pull").plan.exercises.find(row => row.exerciseId === 7);
  assert.equal(plan.setTargets[0].reps, 5);
  const context = buildCoachContext(raw, "next_workout"), target = context.loadTargets.find(row => row.exerciseId === 7).targets[0];
  assert.equal(target.reps, 5);
  const reply = validateCoachReply({ summary: "Practice", cautions: [], nextSet: null,
    plan: { name: "Practice", description: "Assessed repetitions", exercises: [{ exerciseId: 7, reason: "Local calculation", targets: [target] }] } }, context);
  assert.equal(reply.plan.exercises[0].targets[0].reps, 5);
});

test("a 28-day gap gives one lighter calibration, not three full old-weight sets; past records remain unchanged", async () => {
  const raw = await seed(1, [[60, 8], [60, 8], [60, 8]], 42), before = structuredClone(raw);
  const prediction = buildNextExercisePrediction(raw, 1, +now);
  assert.equal(prediction.next.action, "calibrate"); assert.equal(prediction.next.weightKg, 52.5);
  const plan = buildDailyWorkout(raw, now, "push").plan.exercises.find(row => row.exerciseId === 1);
  assert.equal(plan.sets, 1); assert.equal(plan.setTargets[0].weightKg, 52.5);
  assert.equal(buildTrainingAnalysis(raw, undefined, now).exercises.length, 0, "the recent analysis window must not invent activity");
  assert.deepEqual(raw, before);
});

test("bodyweight progression does not silently add external load after reaching the repetition ceiling", async () => {
  await seed(7, [[0, 12], [0, 12], [0, 12]], 4);
  const raw = await seed(7, [[0, 12], [0, 12], [0, 12]], 2);
  assert.equal(buildNextExercisePrediction(raw, 7, +now).next.weightKg, 0);
  assert.equal(buildTrainingAnalysis(raw, undefined, now).exercises.find(row => row.exerciseId === 7).next.weightKg, 0);
});

test("after a long bodyweight break the probe removes old added load rather than assuming it is still feasible", async () => {
  const raw = await seed(7, [[20, 8], [20, 8], [20, 8]], 42);
  const prediction = buildNextExercisePrediction(raw, 7, +now);
  assert.equal(prediction.next.action, "calibrate"); assert.equal(prediction.next.weightKg, 0); assert.equal(prediction.next.reps, 3);
  assert.equal(raw.sets[0].weightKg, 20);
});

test("an unmanageable minimum-load exercise yields an available same-group alternative, without changing catalog or history", async () => {
  const raw = await seed(26, [[20, 2, 0]]), before = structuredClone(raw);
  const plan = buildDailyWorkout(raw, now, "push").plan;
  assert.ok(!plan.exercises.some(row => row.exerciseId === 26));
  assert.ok(plan.exercises.some(row => row.muscleGroup === "Трицепс" && row.exerciseId !== 26));
  assert.deepEqual(raw, before);
});

test("the AI gateway preserves canonical 5 kg local progression but does not grant the same freedom to legacy uncalculated replies", async () => {
  mock.timers.enable({ apis: ["Date"], now: +now });
  await seed(1, [[50, 12, 4], [50, 12, 4], [50, 12, 4]], 4);
  const raw = await seed(1, [[50, 12, 4], [50, 12, 4], [50, 12, 4]], 2);
  const context = buildCoachContext(raw, "next_workout");
  assert.equal(context.loadTargets.find(row => row.exerciseId === 1).targets[0].weightKg, 55);
  const proposal = { summary: "Confirmed load", cautions: [], nextSet: null, plan: { name: "Test", description: "Local numbers", exercises: [
    { exerciseId: 1, reason: "Local calculation", targets: [{ weightKg: 500, reps: 30, durationSeconds: null }] },
  ] } };
  assert.equal(validateCoachReply(proposal, context).plan.exercises[0].targets[0].weightKg, 55);
  const legacy = { ...context }; delete legacy.loadSelection; delete legacy.loadTargets;
  await assert.rejects(async () => validateCoachReply(proposal, legacy));
});

test("eight deterministic month diaries exercise the real API and backups, with no invalid loads/ranges/split repeats", async () => {
  const first = await simulateCohort(), second = await simulateCohort();
  assert.deepEqual(first, second);
  assert.equal(first.people.length, 8);
  const baselineFailures = [5, 0, 4, 0, 19, 3, 14, 1];
  for (const [i, person] of first.people.entries()) {
    for (const metric of ["belowBarbell", "outOfRange", "repeatedSplit", "missingLoads"]) assert.equal(person.checks[metric], 0, `${person.id}: ${metric}`);
    assert.ok(person.checks.responseFailures <= baselineFailures[i], `${person.id}: synthetic failure regression`);
    assert.ok(person.workouts >= 6 && person.workouts <= 16);
  }
  const beginner = first.people.find(row => row.id === "novice");
  assert.ok(beginner.exerciseProgress.find(row => row.id === 7).last.reps > 3);
  assert.ok(beginner.exerciseProgress.find(row => row.id === 24).last.reps >= 10);
  assert.ok(first.people.reduce((n, row) => n + row.findings.length, 0) < 21);
});
