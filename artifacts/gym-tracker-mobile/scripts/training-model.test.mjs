import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { epleyWithRir, qualityEstimate, estimateStrength, predictWeight, predictReps, roundWeightDown, controlPrediction, validateCoachReply, modelForecastSchema } from "@workspace/ai-coach";
const { forecastWorkingSets, buildActivePrediction } = await import("../lib/trainingPrediction.ts");
const { buildTrainingAnalysis } = await import("../lib/trainingAnalysis.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const now = Date.parse("2026-10-21T15:00:00Z");
const row = (id, weightKg = 70, reps = 8, rir = 2, index = 0) => ({ workoutId: id, workoutStartedAt: `2026-10-${String(10 + id).padStart(2, "0")}T10:00:00Z`, workoutFinishedAt: `2026-10-${String(10 + id).padStart(2, "0")}T11:00:00Z`, createdAt: `2026-10-${String(10 + id).padStart(2, "0")}T10:${String(index * 3).padStart(2, "0")}:00Z`, weightKg, reps, rir, technique: "good" });
const range = { sets: 3, repsMin: 8, repsMax: 12, targetRir: 2, weightStepKg: 2.5 };
const guard = { weightKg: 70, reps: 9, action: "progress_reps", reason: "Fixture" };
const predict = (rows, equipment = { equipment: "barbell" }, current = []) => forecastWorkingSets(rows, range, guard, equipment, now, current);
beforeEach(() => storage.clear());

test("hypertrophy controller never converts a heavy single to a working prescription", () => {
  const original = { weightKg: 85, reps: 1, action: "hold", reason: "Heavy single" };
  const unknown = controlPrediction({ strengthKg: null, guard: original, repsMin: 8, repsMax: 12, targetRir: 2, stepKg: 2.5, minimumKg: 20 });
  assert.equal(unknown.action, "calibrate");
  assert.equal(unknown.reps, 8);
  assert.equal(unknown.weightKg, 20);
  const measured = controlPrediction({ strengthKg: 90, guard: original, repsMin: 8, repsMax: 12, targetRir: 2, stepKg: 2.5, minimumKg: 20 });
  assert.ok(measured.weightKg <= 67.5);
  assert.ok(measured.reps >= 8);
});

test("Epley + RIR matches the document and its inverse without rounding", () => {
  assert.ok(Math.abs(epleyWithRir(70, 8, 2) - 93.3333333333) < 1e-7);
  assert.equal(predictWeight(90, 8, 2), 67.5);
  assert.ok(Math.abs(predictReps(90, 67.5, 2) - 8) < 1e-8);
  assert.ok(Math.abs(predictReps(90, 67.5, 2, 2) - 6) < 1e-8);
  assert.ok(Math.abs(predictReps(90, predictWeight(90, 8, 2, 2), 2, 2) - 8) < 1e-8);
});
test("nonfinite, zero loads, singles, high reps and unknown effort are not measurements", () => {
  for (const args of [[0, 8, 2], [70, 1, 2], [70, 11, 2], [70, 8, 4], [NaN, 8, 2], [Infinity, 8, 2], [70, 8.5, 2], [70, 8, -1], [Number.MAX_VALUE, 10, 3]]) assert.equal(epleyWithRir(...args), null);
  for (const values of [{ rir: null }, { technique: null }, { technique: "breakdown" }, { durationSeconds: 30 }]) assert.equal(qualityEstimate({ ...row(1), ...values }), null);
  assert.equal(predictReps(90, 0, 2), null); assert.equal(predictWeight(90, 0, 2), null);
});
test("rounding uses the actual equipment grid and the barbell minimum", () => {
  assert.equal(roundWeightDown(68.4, 2.5, 20), 67.5);
  assert.equal(roundWeightDown(22, 1.25, 20), 21.25);
  assert.equal(roundWeightDown(15, 6, 20), 20);
  assert.equal(roundWeightDown(25.5, 3, 20), 23);
  assert.equal(roundWeightDown(20.3, 0, 0), null);
});
test("EMA updates once per session, not from each later fatigued set", () => {
  const first = row(1, 67.5, 8, 2), second = row(2, 69.75, 8, 2);
  const value = estimateStrength([second, row(2, 69.75, 5, 2, 1), first, row(1, 67.5, 6, 2, 1)], now);
  assert.ok(Math.abs(value.estimated1RMKg - 90.6) < 1e-8);
  assert.equal(value.sessions, 2); assert.equal(value.validationSamples, 1);
});
test("walk-forward error is computed before observing the held-out performance", () => {
  const value = estimateStrength([row(1, 67.5, 8, 2), row(2, 67.5, 10, 2)], now);
  assert.equal(value.validationSamples, 1); assert.ok(Math.abs(value.repErrorMAE - 2) < 1e-8);
  const future = { ...row(3, 100, 8, 2), workoutStartedAt: "2026-10-25T10:00:00Z", workoutFinishedAt: "2026-10-25T11:00:00Z" };
  assert.deepEqual(estimateStrength([row(1), future], now), estimateStrength([row(1)], now));
});
test("fatigue is fitted only after multiple within-session comparisons on two days", () => {
  const a = [row(1, 60, 10, 2), row(1, 60, 9, 2, 1), row(1, 60, 8, 2, 2)];
  assert.equal(estimateStrength(a, now).fatigueBeta, null);
  const value = estimateStrength([...a, row(2, 60, 10, 2), row(2, 60, 9, 2, 1)], now);
  assert.equal(value.fatigueBeta, 1); assert.equal(value.fatigueSamples, 3);
  assert.equal(value.estimated1RMKg, 84);
});
test("different loads, missing RIR and worsening technique cannot fit fatigue", () => {
  const value = estimateStrength([row(1), row(1, 60, 7, 2, 1), row(2), { ...row(2, 70, 6, null, 1), technique: "breakdown" }], now);
  assert.equal(value.fatigueBeta, null); assert.equal(value.fatigueSamples, 0);
});
test("long gaps reset the estimate, stale models cannot control current loads", () => {
  const old = { ...row(1, 100), workoutStartedAt: "2026-09-01T10:00:00Z", workoutFinishedAt: "2026-09-01T11:00:00Z" };
  assert.equal(predict([old]).model.status, "stale");
  assert.equal(predict([old]).next.weightKg, guard.weightKg);
  const value = estimateStrength([old, row(2, 50)], now);
  assert.equal(value.sessions, 1); assert.equal(value.validationSamples, 0);
  assert.ok(Math.abs(value.estimated1RMKg - epleyWithRir(50, 8, 2)) < 1e-8);
});
test("a strong formula never overrides a hold, reduction, calibration or equipment ceiling", () => {
  for (const action of ["hold", "reduce", "calibrate", "progress_reps", "increase"]) {
    const result = controlPrediction({ strengthKg: 500, guard: { ...guard, action }, repsMin: 8, repsMax: 12, targetRir: 2, stepKg: 5, minimumKg: 20 });
    assert.ok(result.weightKg <= guard.weightKg); assert.ok(result.reps <= guard.reps);
    if (action === "calibrate") assert.equal(result.predictedReps, null);
  }
});
test("bodyweight at zero extra load, assistance, seconds and other equipment have no Epley estimate", () => {
  for (const equipment of [{ equipment: "bodyweight" }, { equipment: "machine", assisted: true }, { equipment: "barbell", timed: true }, { equipment: "other" }]) {
    const value = predict([row(1)], equipment);
    assert.equal(value.model.status, "unsupported"); assert.equal(value.model.estimated1RMKg, null); assert.deepEqual(value.model.targets, []);
  }
});
test("legacy barbell loads below 20 kg neither train strength nor escape the equipment minimum", () => {
  const history = [row(1, 2.5)], saved = structuredClone(history);
  const value = forecastWorkingSets(history, range, { ...guard, weightKg: 2.5 }, { equipment: "barbell" }, now);
  assert.equal(value.next.weightKg, 20); assert.equal(value.next.action, "calibrate");
  assert.equal(value.model.estimated1RMKg, null); assert.deepEqual(history, saved);
  const direct = controlPrediction({ strengthKg: 500, guard: { ...guard, weightKg: 2.5 }, repsMin: 8, repsMax: 12, targetRir: 2, stepKg: 2.5, minimumKg: 20 });
  assert.equal(direct.weightKg, 20); assert.equal(direct.predictedReps, null);
});
test("no historical prescription means MAE_RIR is unknown, not a fabricated quality metric", () => {
  const value = predict([row(1), row(2)]);
  assert.equal(value.model.rirErrorMAE, null); assert.equal(value.model.validationSamples, 1);
  assert.doesNotThrow(() => modelForecastSchema.parse(value.model));
});
test("out-of-domain high reps do not let an older formula deadlock two proven full sessions", async () => {
  let focus;
  for (const reps of [10, 12, 12]) {
    focus = await request("/api/workouts", "POST");
    for (let i = 0; i < 3; i++) await request(`/api/workouts/${focus.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps, rir: 2, technique: "good" });
    await request(`/api/workouts/${focus.id}/finish`, "POST");
  }
  const analysis = await request(`/api/workouts/${focus.id}/analysis`);
  assert.equal(analysis.exercises[0].next.weightKg, 42.5);
  assert.equal(analysis.exercises[0].model.status, "insufficient");
  assert.equal(analysis.exercises[0].model.predictedReps, null);
  assert.match(analysis.exercises[0].model.note, /не старым прогнозом/);
});
test("today's first valid set adapts today's targets without rewriting the long-term estimate", () => {
  const value = predict([row(1, 60)], { equipment: "barbell" }, [row(9, 70)]);
  assert.equal(value.model.source, "today"); assert.ok(Math.abs(value.model.estimated1RMKg - epleyWithRir(70, 8, 2)) < 1e-8);
  assert.ok(Math.abs(estimateStrength([row(1, 60)], now).estimated1RMKg - epleyWithRir(60, 8, 2)) < 1e-8);
});
test("the next set is lighter after a low-RIR first calibration with good technique", async () => {
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", {
    exerciseId: 1, weightKg: 70, reps: 8, rir: 1, technique: "good",
  });
  const prediction = await request(`/api/workouts/${w.id}/prediction/1`);
  assert.equal(prediction.next.action, "reduce");
  assert.ok(prediction.next.weightKg < 70, "do not repeat an over-heavy first set");
  assert.ok(prediction.next.reps >= 8);
});

test("a later reduced set or technique breakdown takes precedence over first-set effort", async () => {
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 70, reps: 8, rir: 1, technique: "good" });
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 3, technique: "good" });
  assert.ok((await request(`/api/workouts/${w.id}/prediction/1`)).next.weightKg <= 50);
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 8, rir: 0, technique: "breakdown" });
  const prediction = await request(`/api/workouts/${w.id}/prediction/1`);
  assert.equal(prediction.next.action, "reduce");
  assert.ok(prediction.next.weightKg < 50, "a failed later set must not restore the first heavier load");
});

test("low RIR never automatically reduces an assisted machine's counterweight", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80, sex: "male" });
  const exercise = await request("/api/exercises", "POST", { name: "Подтягивания с противовесом QA", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: exercise.id, weightKg: 30, reps: 8, rir: 1, technique: "good" });
  const prediction = await request(`/api/workouts/${w.id}/prediction/${exercise.id}`);
  assert.equal(prediction.model.status, "unsupported");
  assert.equal(prediction.next.weightKg, 30);
});

test("online model, next-set context and manual application preserve recorded history", async () => {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 70, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 70, reps: 8, rir: 2, technique: "good" } });
  const saved = new Map(storage);
  const prediction = await request(`/api/workouts/${workout.id}/prediction/1`);
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: workout.id });
  assert.equal(prediction.model.source, "today"); assert.equal(prediction.next.weightKg, 70);
  assert.equal(context.nextSetTarget.weightKg, prediction.next.weightKg);
  const reply = validateCoachReply({ summary: "Analysis", cautions: [], plan: null, nextSet: { exerciseId: 1, weightKg: 500, reps: 30, durationSeconds: null, reason: "LLM numbers cannot override local calculation" } }, context);
  assert.equal(reply.nextSet.weightKg, prediction.next.weightKg); assert.equal(reply.nextSet.reps, prediction.next.reps);
  assert.deepEqual(storage, saved);
});
test("historical category/dumbbell changes cannot train the new variant", async () => {
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 3, weightKg: 30, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  await request("/api/exercises/3", "PATCH", { dumbbellCount: 2 });
  const current = await request("/api/workouts", "POST");
  assert.equal((await request(`/api/workouts/${current.id}/prediction/3`)).model.status, "insufficient");
  await request("/api/exercises/3", "PATCH", { equipment: "machine" });
  assert.equal((await request(`/api/workouts/${current.id}/prediction/3`)).model.sessions, 0);
});
test("a past review and an active workout cannot train from later finished workouts", async () => {
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  const current = await request("/api/workouts", "POST");
  const raw = JSON.parse(storage.get(PROGRESS_KEY));
  raw.workouts[0].startedAt = "2026-10-11T10:00:00Z"; raw.workouts[0].finishedAt = "2026-10-11T11:00:00Z";
  raw.workouts[1].startedAt = "2026-10-12T10:00:00Z";
  const before = buildTrainingAnalysis(raw, w.id, new Date(now));
  const beforeActive = buildActivePrediction(raw, current.id, 1, now);
  raw.workouts.push({ id: 99, startedAt: "2026-10-15T10:00:00Z", finishedAt: "2026-10-15T11:00:00Z" });
  raw.sets.push({ ...raw.sets[0], id: 99, workoutId: 99, weightKg: 100 });
  assert.deepEqual(buildTrainingAnalysis(raw, w.id, new Date(now)), before);
  assert.deepEqual(buildActivePrediction(raw, current.id, 1, now), beforeActive);
});
