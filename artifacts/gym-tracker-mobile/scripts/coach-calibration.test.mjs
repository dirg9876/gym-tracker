import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY, PLAN_PREFIX } = await import("../lib/progressStorage.ts");
const { retryDraftAction } = await import("../lib/workoutDraft.ts");
beforeEach(() => { storage.clear(); delete globalThis.__storageFault; });
const context = task => request("/api/ai-coach/context", "POST", { task: task ?? "next_workout" });
const reply = (exerciseId = 3, weightKg = null) => ({ summary: "Load calibration", cautions: [], nextSet: null, plan: { name: "Start", description: "First observation", exercises: [{ exerciseId, reason: "First set calibrates load", targets: Array.from({ length: 3 }, () => ({ weightKg, reps: 10, durationSeconds: null })) }] } });
async function start(exerciseId = 3) {
  const ctx = await context();
  const result = validateCoachReply(reply(exerciseId), ctx);
  return request("/api/ai-coach/apply-plan", "POST", { context: ctx, fingerprint: await coachFingerprint(ctx), plan: setCoachProposal(result, ctx) });
}
async function commit(id, feedback) {
  const path = `/api/workouts/${id}/draft`;
  const current = await request(path);
  const updated = await request(path, "PUT", { revision: current.revision, draft: { ...current.draft, ...feedback } });
  return request(`${path}/commit`, "POST", { revision: updated.revision });
}
test("all proposed weights are concrete, equipment-specific; legacy clients retain nullable unknown loads", async () => {
  const ctx = await context();
  for (const [id, weight] of [[1, 20], [3, 2.5], [7, 0], [10, 5]]) {
    const result = validateCoachReply(reply(id), ctx);
    assert.ok(result.plan.exercises[0].targets.every(set => set.weightKg === weight && set.reps <= (id === 7 ? 3 : 8)));
  }
  const legacy = { ...ctx }; delete legacy.loadSelection;
  assert.equal(validateCoachReply(reply(), legacy).plan.exercises[0].targets[0].weightKg, null);
  assert.throws(() => validateCoachReply(reply(3, 50), ctx));
});
test("null known load is filled from this exercise's actual history, never another exercise", async () => {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 3, weightKg: 15, reps: 8 });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  const ctx = await context();
  assert.equal(validateCoachReply(reply(), ctx).plan.exercises[0].targets[0].weightKg, 15);
  assert.equal(validateCoachReply(reply(1), ctx).plan.exercises[0].targets[0].weightKg, 20);
});
test("first set requires reserve/technique without recording on failure", async () => {
  const workout = await start();
  const draft = await request(`/api/workouts/${workout.id}/draft`);
  await assert.rejects(request(`/api/workouts/${workout.id}/draft/commit`, "POST", { revision: draft.revision }), /подборочного/);
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalSets, 0);
});
test("easy first set adjusts future loads atomically, survives backup, and a replay cannot double-increase", async () => {
  const workout = await start();
  const result = await commit(workout.id, { rir: 4, technique: "good" });
  let plan = await loadPlan(workout.id);
  assert.deepEqual(plan.exercises[0].setTargets.map(set => set.weightKg), [2.5, 5, 5]);
  assert.equal(result.draft.weightKg, 5);
  assert.equal(result.set.weightKg, 2.5);
  assert.equal(plan.exercises[0].calibration, false);
  const replay = await request(`/api/workouts/${workout.id}/draft/commit`, "POST", { revision: result.revision - 1 });
  assert.equal(replay.set.id, result.set.id);
  await restoreProgress(await exportProgress());
  plan = await loadPlan(workout.id);
  assert.deepEqual(plan.exercises[0].setTargets.map(set => set.weightKg), [2.5, 5, 5]);
});
test("no reserve or broken technique reduces load, never goes below barbell minimum", async () => {
  const workout = await start(1);
  const result = await commit(workout.id, { rir: 0, technique: "breakdown" });
  assert.equal(result.draft.weightKg, 20);
  assert.equal(result.draft.reps, 6);
  assert.equal(result.set.reps, 8);
});
test("bodyweight calibration adjusts repetitions rather than inventing extra load", async () => {
  const workout = await start(7);
  const result = await commit(workout.id, { rir: 4, technique: "good" });
  assert.equal(result.draft.weightKg, 0);
  assert.equal(result.draft.reps, 4);
});
test("Muscles goal reaches next set, session, adjustment and month contexts and persists in backups", async () => {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  for (const task of ["next_workout", "month_plan"]) assert.equal((await context(task)).preferences.goal, "hypertrophy");
  const workout = await start();
  for (const task of ["next_set", "adjust_workout"]) assert.equal((await request("/api/ai-coach/context", "POST", { task, workoutId: workout.id })).preferences.goal, "hypertrophy");
  await restoreProgress(await exportProgress());
  assert.equal((await context()).preferences.goal, "hypertrophy");
});

for (const keyType of ["state", "plan"]) test(`interrupted calibration ${keyType} write cannot split recorded set, plan and next draft`, async () => {
  const workout = await start();
  const path = `/api/workouts/${workout.id}/draft`;
  const old = await request(path);
  const draft = await request(path, "PUT", { revision: old.revision, draft: { ...old.draft, rir: 4, technique: "good" } });
  let fired = false;
  globalThis.__storageFault = ({ operation, key, phase }) => {
    if (!fired && operation === "multiSet" && phase === "after" && key === (keyType === "state" ? PROGRESS_KEY : PLAN_PREFIX + workout.id)) { fired = true; throw new Error("Interrupted calibration"); }
  };
  const result = await retryDraftAction(() => request(`${path}/commit`, "POST", { revision: draft.revision }));
  assert.ok(fired);
  assert.equal(result.draft.weightKg, 5);
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalSets, 1);
  assert.deepEqual((await loadPlan(workout.id)).exercises[0].setTargets.map(set => set.weightKg), [2.5, 5, 5]);
  delete globalThis.__storageFault;
});

test("month weights are concrete too, while office never reuses historical added weight", async () => {
  const ctx = await context("month_plan");
  const month = { name: "Month", overview: "Calibrate first set", daysPerWeek: 3, templates: [reply().plan], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Conditional progression", sessions: [0, 0, 0] })) };
  const result = validateCoachReply({ summary: "Month", cautions: [], nextSet: null, plan: null, monthly: month }, ctx);
  assert.ok(result.monthly.templates[0].exercises[0].targets.every(set => set.weightKg === 2.5));
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 7, weightKg: 10, reps: 5 });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  const office = await request("/api/ai-coach/context", "POST", { task: "next_workout", trainingMode: "office" });
  assert.equal(validateCoachReply(reply(7), office).plan.exercises[0].targets[0].weightKg, 0);
});

test("starting with a later exercise stays there for its next calibrated set, not a skipped earlier exercise", async () => {
  const ctx = await context(); const proposed = reply(1);
  proposed.plan.exercises.push(...reply(3).plan.exercises);
  const result = validateCoachReply(proposed, ctx);
  const workout = await request("/api/ai-coach/apply-plan", "POST", { context: ctx, fingerprint: await coachFingerprint(ctx), plan: setCoachProposal(result, ctx) });
  const next = await commit(workout.id, { exerciseId: 3, weightKg: 2.5, reps: 8, rir: 4, technique: "good" });
  assert.equal(next.draft.exerciseId, 3);
  assert.equal(next.draft.weightKg, 5);
  assert.equal((await loadPlan(workout.id)).exercises[0].setTargets[0].weightKg, 20);
});
