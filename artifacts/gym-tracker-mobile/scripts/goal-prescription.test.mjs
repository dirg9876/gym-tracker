import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { COACH_EVIDENCE, controlPrediction, defaultCoachProfile, goalPrescription, validateCoachReply } from "@workspace/ai-coach";
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { buildNextExercisePrediction } = await import("../lib/trainingPrediction.ts");
const { calibrateRemaining } = await import("../lib/workoutTemplates.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
beforeEach(() => storage.clear());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const ratings = { rir: 2, technique: "good" };
async function record(exerciseId, reps, weightKg = 40) {
  const w = await request("/api/workouts", "POST");
  for (let i = 0; i < 3; i++) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId, weightKg, reps, ...ratings });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  return w;
}
async function muscles() {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
}

test("the repetition ceiling applies with and without a usable formula, without authorizing heavier weight", () => {
  for (const strengthKg of [null, 1000]) for (const action of ["hold", "calibrate", "reduce", "progress_reps", "increase"]) {
    const guard = { weightKg: 40, reps: 20, action, reason: "fixture" };
    const result = controlPrediction({ strengthKg, guard, repsMin: 8, repsMax: 12, targetRir: 2, stepKg: 2.5, minimumKg: 20 });
    assert.ok(result.reps <= 12, `${action}, strength=${strengthKg}: ${result.reps}`);
    assert.ok(result.weightKg <= 40);
    assert.equal(guard.reps, 20, "historical/input values are not rewritten");
  }
});

test("calibration never copies an above-range record into future targets or adds a thirteenth bodyweight rep", () => {
  for (const equipment of ["bodyweight", "dumbbell"]) {
    const exercise = { equipment, calibration: true, sets: 1, postCalibrationSets: 2, repsMin: 8, repsMax: 12,
      targetRir: 2, weightStepKg: 2.5, setTargets: [{ weightKg: equipment === "bodyweight" ? 0 : 10, reps: 8 }] };
    for (const reps of [12, 20]) {
      const result = calibrateRemaining(exercise, { weightKg: exercise.setTargets[0].weightKg, reps, rir: 4, technique: "good" }, 1);
      assert.equal(result.setTargets[0].reps, reps, "actual completed work remains intact");
      assert.ok(result.setTargets.slice(1).every(set => set.reps <= 12));
      assert.equal(result.repsMax, 12);
    }
  }
});

test("muscle goal ignores unrelated saved template ranges but an explicitly chosen manual range remains possible", async () => {
  await muscles();
  await request("/api/programs", "POST", { name: "Old high-rep template", exercises: [{ exerciseId: 1, sets: 3, repsMin: 15, repsMax: 25, intent: "hypertrophy" }] });
  const w = await record(1, 20);
  const saved = new Map(storage);
  const automatic = buildNextExercisePrediction(state(), 1, Date.now());
  assert.ok(automatic.next.reps <= 12);
  const analysis = await request(`/api/workouts/${w.id}/analysis`);
  assert.deepEqual([analysis.exercises[0].range.repsMin, analysis.exercises[0].range.repsMax], [8, 12]);
  const manual = buildNextExercisePrediction(state(), 1, Date.now(), { sets: 3, repsMin: 15, repsMax: 25 });
  assert.ok(manual.next.reps >= 15);
  assert.deepEqual(storage, saved);
});

test("a saved month cannot define hypertrophy ranges from its suggested high repetitions", async () => {
  await muscles();
  await record(1, 20); await record(21, 20, 10);
  const raw = state(), original = structuredClone(raw);
  const template = { name: "Old month", description: "", exercises: [1, 21, 30].map(exerciseId => ({ exerciseId, reason: "old prescription", targets: Array.from({ length: 3 }, () => exerciseId === 30
    ? { weightKg: 0, reps: 0, durationSeconds: 45 } : { weightKg: exerciseId === 21 ? 10 : 40, reps: 25, durationSeconds: null }) })) };
  raw.coachMonth = { id: "fixture", createdAt: new Date().toISOString(), plan: { name: "Month", overview: "", daysPerWeek: 3, templates: [template], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "", sessions: [0, 0, 0] })) } };
  const snapshot = structuredClone(raw);
  const offered = buildDailyWorkout(raw);
  assert.equal(offered.source, "month");
  for (const [id, min, max] of [[1, 8, 12], [21, 10, 15]]) {
    const exercise = offered.plan.exercises.find(ex => ex.exerciseId === id);
    assert.deepEqual([exercise.repsMin, exercise.repsMax], [min, max]);
    assert.ok(exercise.setTargets.every(set => set.reps <= max));
  }
  assert.ok(offered.plan.exercises.find(ex => ex.exerciseId === 30).setTargets.every(set => set.durationSeconds === 45 && set.reps === 0));
  assert.deepEqual(raw, snapshot);
  assert.deepEqual(state(), original);
});

test("isolation has a real 10-15 range; two full successful sessions add one weight step and reset repetitions", async () => {
  await muscles();
  await request("/api/exercises/21", "PATCH", { weightStepKg: 1 });
  await record(21, 15, 10);
  let next = buildNextExercisePrediction(state(), 21, Date.now()).next;
  assert.equal(next.reps, 15); assert.equal(next.weightKg, 10); assert.equal(next.action, "hold");
  await record(21, 15, 10);
  next = buildNextExercisePrediction(state(), 21, Date.now()).next;
  assert.equal(next.reps, 10); assert.equal(next.weightKg, 11); assert.equal(next.action, "increase");
});

test("catalog movement classification distinguishes compound presses from French presses and calf presses", async () => {
  const exercises = await request("/api/exercises");
  for (const [id, min, max] of [[1, 8, 12], [3, 8, 12], [7, 8, 12], [10, 8, 12], [12, 8, 12], [14, 8, 12], [16, 10, 15], [18, 10, 15], [21, 10, 15], [23, 10, 15], [26, 10, 15], [28, 8, 12]]) {
    const result = goalPrescription("hypertrophy", exercises.find(ex => ex.id === id));
    assert.deepEqual([result.repsMin, result.repsMax], [min, max], `exercise ${id}`);
  }
  const calf = goalPrescription("hypertrophy", { name: "Жим ногами сидя на икры", muscleGroup: "Ноги", equipment: "machine" });
  assert.equal(calf.repsMax, 15);
});

test("hypertrophy is not a universal twelve-rep limit and sources separate research from model assumptions", () => {
  assert.equal(goalPrescription("strength", { name: "Жим штанги лёжа", muscleGroup: "Грудь", equipment: "barbell" }).repsMax, 6);
  assert.ok(COACH_EVIDENCE.sources.some(source => source.url === "https://doi.org/10.47206/ijsc.v1i1.81"));
  assert.ok(COACH_EVIDENCE.principles.some(text => text.includes("not a biological ceiling")));
  assert.ok(COACH_EVIDENCE.principles.some(text => text.includes("approximate model assumptions")));
});

test("an unknown isolation movement has a short assessed probe, not an untested ten-rep first set", async () => {
  await muscles();
  const prediction = buildNextExercisePrediction(state(), 21, Date.now());
  assert.equal(prediction.next.action, "calibrate");
  assert.ok(prediction.next.reps <= 8);
  const single = controlPrediction({ strengthKg: null, guard: { weightKg: 85, reps: 1, action: "calibrate", reason: "fixture" }, repsMin: 10, repsMax: 15, targetRir: 2, stepKg: 2.5, minimumKg: 20 });
  assert.equal(single.weightKg, 20); assert.equal(single.reps, 8);
});

test("the daily plan explains the goal, actual calculation and equipment rounding without treating high reps as a measurement", async () => {
  await muscles(); await record(1, 8, 70);
  const saved = new Map(storage), raw = state();
  const now = new Date();
  raw.coachMonth = { id: "fixture", createdAt: now.toISOString(), plan: { name: "Month", overview: "fixture", daysPerWeek: 3,
    templates: [{ name: "Bench", description: "", exercises: [{ exerciseId: 1, reason: "fixture", targets: [{ weightKg: 70, reps: 25, durationSeconds: null }] }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "fixture", sessions: [0, 0, 0] })) } };
  const bench = buildDailyWorkout(raw, now).plan.exercises[0];
  assert.match(bench.note, /Цель «Мышцы».*8–12/);
  assert.match(bench.note, /Оценка 1ПМ 93,33 кг/);
  assert.match(bench.note, /Шаг 2,5 кг/);
  assert.ok(bench.setTargets[0].weightKg <= 70 && bench.setTargets[0].reps <= 12);
  assert.deepEqual(storage, saved);
});

test("AI plans and monthly plans receive and retain the same bounded local numerical prescriptions", async () => {
  await muscles(); await record(1, 20); await record(21, 20, 10);
  for (const task of ["next_workout", "month_plan"]) {
    const ctx = await request("/api/ai-coach/context", "POST", { task });
    const plan = { name: "AI fixture", description: "", exercises: [1, 21].map(exerciseId => ({ exerciseId, reason: "fixture", targets: [{ weightKg: 40, reps: 30, durationSeconds: null }] })) };
    const value = { summary: "fixture", cautions: [], nextSet: null, plan: task === "next_workout" ? plan : null,
      ...(task === "month_plan" ? { monthly: { name: "Month", overview: "fixture", daysPerWeek: 3, templates: [plan], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "fixture", sessions: [0, 0, 0] })) } } : {}) };
    const result = validateCoachReply(value, ctx);
    const exercises = result.plan?.exercises ?? result.monthly.templates[0].exercises;
    assert.ok(exercises[0].targets.every(set => set.reps <= 12));
    assert.ok(exercises[1].targets.every(set => set.reps <= 15));
  }
});

test("an applied AI plan retains the goal range rather than collapsing it to the first target or expanding it from history", async () => {
  await muscles(); await record(21, 15, 10);
  const ctx = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  const result = validateCoachReply({ summary: "fixture", cautions: [], nextSet: null,
    plan: { name: "Isolation", description: "", exercises: [{ exerciseId: 21, reason: "fixture", targets: [{ weightKg: 10, reps: 30, durationSeconds: null }] }] } }, ctx);
  const proposal = setCoachProposal(result, ctx);
  assert.deepEqual([proposal.exercises[0].repsMin, proposal.exercises[0].repsMax], [10, 15]);
  const workout = await request("/api/ai-coach/apply-plan", "POST", { context: ctx, fingerprint: await coachFingerprint(ctx), plan: proposal });
  const plan = await loadPlan(workout.id);
  assert.deepEqual([plan.exercises[0].repsMin, plan.exercises[0].repsMax], [10, 15]);
  assert.equal(plan.exercises[0].setTargets[0].reps, 15);
});

test("truncating the AI history does not turn a known fifteen-rep isolation target into a new eight-rep probe", async () => {
  await muscles(); await record(21, 15, 10);
  for (let i = 0; i < 12; i++) await record(1, 8, 70);
  const ctx = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  assert.ok(ctx.sessions.every(session => session.sets.every(set => set.exerciseId !== 21)));
  const result = validateCoachReply({ summary: "fixture", cautions: [], nextSet: null,
    plan: { name: "Isolation", description: "", exercises: [{ exerciseId: 21, reason: "fixture", targets: [{ weightKg: 10, reps: 30, durationSeconds: null }] }] } }, ctx);
  assert.equal(result.plan.exercises[0].targets[0].reps, 15);
  assert.equal(setCoachProposal(result, ctx).exercises[0].calibration, false);
});
