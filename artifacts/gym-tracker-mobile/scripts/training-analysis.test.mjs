import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { coachEnvelopeSchema, coachContextSchema, validateCoachReply, jsonByteLength, coachNeedsCalibration } from "@workspace/ai-coach";
const { buildTrainingAnalysis, formatAnalysisResult } = await import("../lib/trainingAnalysis.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
beforeEach(() => storage.clear());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
async function record(exerciseId = 1, weightKg = 40, reps = 10, ratings = {}) {
  const workout = await request("/api/workouts", "POST");
  for (let i = 0; i < 3; i++) await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, weightKg, reps, ...ratings });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  return workout;
}
const review = context => ({ summary: "Summary", cautions: [], nextSet: null, plan: null, review: { overview: "Observed work, not promised growth", progress: context.analysis.exercises.map(row => ({ exerciseKey: row.key, observation: "Recorded set", interpretation: "Effort is self reported", action: "Repeat the load" })), workload: "Recorded sets and training days", effort: "Feedback may be missing", priorities: [{ title: "Consistency", action: "Repeat", reason: "Short history" }], limitations: ["No recovery information"] } });

test("analysis is deterministic and read-only, counts missing feedback and zero-extra bodyweight without fabricating rest", async () => {
  await record(1, 40, 10, { rir: 2, technique: "good" });
  const focus = await record(7, 0, 6);
  const saved = new Map(storage);
  const a = await request(`/api/workouts/${focus.id}/analysis`);
  assert.equal(a.totals.sets, 6); assert.equal(a.totals.rirKnown, 3);
  assert.equal(a.focus.totals.rirKnown, 0); assert.equal(a.focus.totals.repSets, 3);
  assert.equal(a.exercises[0].best.weightKg, 0); assert.equal(a.exercises[0].next.weightKg, 0);
  assert.equal(a.totals.rirBuckets[6], 3);
  assert.match(a.limitations.join(" "), /фактический отдых/);
  assert.equal("durationMinutes" in a, false);
  assert.deepEqual(await request(`/api/workouts/${focus.id}/analysis`), a);
  assert.deepEqual(storage, saved);
});

test("review of an old workout cannot see future sessions, and compares the same weight with explicit effort confidence", async () => {
  const old = await record(1, 40, 8, { rir: 2, technique: "good" });
  const focus = await record(1, 40, 10, { rir: 2, technique: "good" });
  await record(1, 40, 12, { rir: 0, technique: "good" });
  const value = state();
  value.workouts.forEach((row, i) => { row.startedAt = new Date(2026, 9, 10 + i, 10).toISOString(); row.finishedAt = new Date(2026, 9, 10 + i, 11).toISOString(); });
  const analysis = buildTrainingAnalysis(value, focus.id, new Date(2026, 9, 21));
  assert.equal(analysis.asOf, "2026-10-11");
  assert.equal(analysis.from, "2026-09-14");
  assert.equal(analysis.totals.sets, 6);
  assert.deepEqual(analysis.exercises[0].comparison, { workoutId: old.id, weightKg: 40, previousReps: 8, currentReps: 10, comparableEffort: true });
  assert.equal(analysis.exercises[0].next.weightKg, 40);
  assert.equal(analysis.exercises[0].next.reps, 8);
  assert.ok(Math.abs(analysis.exercises[0].model.estimated1RMKg - (0.8 * (40 * (1 + 10 / 30)) + 0.2 * (40 * (1 + 12 / 30)))) < 1e-8);
  value.sets.find(row => row.workoutId === old.id).rir = null;
  value.sets.filter(row => row.workoutId === old.id).forEach(row => row.rir = null);
  assert.equal(buildTrainingAnalysis(value, focus.id).exercises[0].comparison.comparableEffort, false);
});

test("time and counterweight are not additional weight; changed categories and dumbbell counts do not produce comparisons", async () => {
  const plank = await request("/api/workouts", "POST");
  await request(`/api/workouts/${plank.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45 });
  await request(`/api/workouts/${plank.id}/finish`, "POST");
  const timed = await request(`/api/workouts/${plank.id}/analysis`);
  assert.equal(timed.focus.totals.repSets, 0); assert.equal(timed.exercises[0].next.seconds, 45);
  await record(3, 10, 10, { rir: 2, technique: "good" });
  await request("/api/exercises/3", "PATCH", { equipment: "machine" });
  const machine = await record(3, 10, 10);
  assert.equal((await request(`/api/workouts/${machine.id}/analysis`)).exercises[0].comparison, null);
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const assisted = await request("/api/exercises", "POST", { name: "Assisted fixture", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  const counterweight = await record(assisted.id, 30, 8);
  assert.equal((await request(`/api/workouts/${counterweight.id}/analysis`)).exercises[0].assisted, true);
  assert.equal((await request(`/api/workouts/${counterweight.id}/analysis`)).exercises[0].next.weightKg, 30);
});

test("two full assessed sessions permit a small step, unknown effort and heavy singles never authorize it", async () => {
  await record(1, 40, 12, { rir: 2, technique: "good" });
  let focus = await record(1, 40, 12, { rir: 2, technique: "good" });
  assert.equal((await request(`/api/workouts/${focus.id}/analysis`)).exercises[0].next.weightKg, 42.5);
  focus = await record(1, 40, 12);
  assert.equal((await request(`/api/workouts/${focus.id}/analysis`)).exercises[0].next.weightKg, 40);
  focus = await record(1, 85, 1);
  const afterSingle = (await request(`/api/workouts/${focus.id}/analysis`)).exercises[0].next;
  assert.equal(afterSingle.action, "hold"); assert.equal(afterSingle.weightKg, 40);
  const onlySingle = await record(2, 85, 1);
  const calibration = (await request(`/api/workouts/${onlySingle.id}/analysis`)).exercises[0].next;
  assert.equal(calibration.action, "calibrate"); assert.equal(calibration.weightKg, 20);
  focus = await record(1, 40, 8, { rir: 0, technique: "breakdown" });
  assert.equal((await request(`/api/workouts/${focus.id}/analysis`)).exercises[0].next.weightKg, 37.5);
});

test("new review schema enforces evidence references while legacy requests retain the legacy reply", async () => {
  const focus = await record();
  const context = await request("/api/ai-coach/context", "POST", { task: "review", workoutId: focus.id });
  const good = review(context);
  assert.doesNotThrow(() => validateCoachReply(good, context));
  assert.throws(() => validateCoachReply({ ...good, review: undefined }, context));
  const bad = structuredClone(good); bad.review.progress[0].exerciseKey = "invented";
  assert.throws(() => validateCoachReply(bad, context));
  const { analysis, ...legacy } = context;
  const { review: result, ...legacyReply } = good;
  assert.doesNotThrow(() => validateCoachReply(legacyReply, legacy));
  assert.doesNotThrow(() => coachEnvelopeSchema.parse({ fingerprint: "a".repeat(64), model: "fixture", result: good, budget: { limitUsd: 5, usedUsd: 0, reservedUsd: 0 } }));
});

test("plans cannot exceed the local next-session ceiling, and context sizes count UTF-8 bytes", async () => {
  await record(1, 40, 12, { rir: 2, technique: "good" });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  const result = weightKg => ({ summary: "Next", cautions: [], nextSet: null, plan: { name: "Fixture", description: "Fixture", exercises: [{ exerciseId: 1, reason: "Fixture", targets: [{ weightKg, reps: 10, durationSeconds: null }] }] } });
  assert.equal(validateCoachReply(result(42.5), context).plan.exercises[0].targets[0].weightKg, 40);
  context.analysis.exercises.forEach(row => { delete row.model; });
  assert.throws(() => validateCoachReply(result(42.5), context));
  assert.doesNotThrow(() => validateCoachReply(result(40), context));
  assert.equal(jsonByteLength({ text: "Привет" }), Buffer.byteLength(JSON.stringify({ text: "Привет" })));
  const raw = state();
  for (let i = 0; i < 120; i++) raw.exercises.push({ ...raw.exercises[0], id: 1000 + i, name: "У".repeat(100), muscleGroup: "М".repeat(60) });
  const { buildCoachContext } = await import("../lib/aiCoachContext.ts");
  const large = buildCoachContext(raw, "next_workout");
  assert.ok(jsonByteLength(large) <= 58000); assert.equal(large.truncated, true);
  assert.doesNotThrow(() => coachContextSchema.parse(large));
});

test("a known heavy single still requires calibration, its first feedback is mandatory and remaining weights adjust", async () => {
  await record(1, 85, 1);
  const context = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  assert.equal(coachNeedsCalibration(context, 1), true);
  const reply = validateCoachReply({ summary: "Calibrate", cautions: [], nextSet: null, plan: { name: "Calibration", description: "", exercises: [{ exerciseId: 1, reason: "No rep-range data", targets: [0, 1, 2].map(() => ({ weightKg: null, reps: 10, durationSeconds: null })) }] } }, context);
  assert.deepEqual(reply.plan.exercises[0].targets.map(set => [set.weightKg, set.reps]), [[20, 8], [20, 8], [20, 8]]);
  const plan = setCoachProposal(reply, context);
  assert.equal(plan.exercises[0].calibration, true);
  const active = await request("/api/ai-coach/apply-plan", "POST", { context, fingerprint: await coachFingerprint(context), plan });
  const path = `/api/workouts/${active.id}/sets`;
  await assert.rejects(request(path, "POST", { exerciseId: 1, weightKg: 20, reps: 8 }), { status: 400 });
  await request(path, "POST", { exerciseId: 1, weightKg: 20, reps: 8, rir: 4, technique: "good" });
  assert.deepEqual((await loadPlan(active.id)).exercises[0].setTargets.map(set => set.weightKg), [20, 22.5, 22.5]);
});

test("an extreme UTF-8 catalog is bounded without dropping the selected exercise and native control steps are respected", async () => {
  const workout = await record(1, 40, 10, { rir: 3, technique: "good" });
  const value = state();
  value.exercises = Array.from({ length: 120 }, (_, i) => ({ ...value.exercises[0], id: i + 1, name: "Я".repeat(120), muscleGroup: "М".repeat(120) }));
  const { buildCoachContext } = await import("../lib/aiCoachContext.ts");
  const large = buildCoachContext(value, "review", workout.id);
  assert.ok(jsonByteLength(large) <= 58000);
  assert.equal(large.truncated, true);
  const active = await request("/api/workouts", "POST");
  await request("/api/exercises/1", "PATCH", { weightStepKg: 1.25 });
  await request(`/api/workouts/${active.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 10, rir: 3, technique: "good" });
  await request(`/api/workouts/${active.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 40, reps: 10 } });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: active.id });
  const result = weightKg => ({ summary: "Next", cautions: [], plan: null, nextSet: { exerciseId: 1, weightKg, reps: 10, durationSeconds: null, reason: "Fixture" } });
  assert.equal(validateCoachReply(result(42.5), context).nextSet.weightKg, context.nextSetTarget.weightKg);
  delete context.nextSetTarget;
  assert.doesNotThrow(() => validateCoachReply(result(41.25), context));
  assert.throws(() => validateCoachReply(result(42.5), context));
  assert.throws(() => validateCoachReply(result(41.5), context));
});

test("legacy unknown plank time is not a zero-kg result and source fields remain unchanged", async () => {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const value = state(); delete value.sets[0].durationSeconds; value.sets[0].reps = 12;
  const before = structuredClone(value);
  const report = buildTrainingAnalysis(value, workout.id);
  assert.equal(report.focus.totals.reps, 0); assert.equal(report.focus.totals.rirKnown, 0);
  assert.equal(formatAnalysisResult(report.exercises[0], false), "Время не записано");
  assert.equal(formatAnalysisResult(report.exercises[0], true), "30 с");
  assert.deepEqual(value, before);
});
