import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { request, storage } from "./testHarness.mjs";
import { coachContextSchema, coachMessagesSchema, validateCoachReply, COACH_EVIDENCE } from "@workspace/ai-coach";
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { exportProgress, parseProgressBackup, restoreProgress } = await import("../lib/progressBackup.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { completedTargets } = await import("../lib/workoutTemplates.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
beforeEach(() => { storage.clear(); delete globalThis.__storageFault; });
const messages = [{ role: "user", text: "Тренажёр занят, замени упражнение." }];
const context = (task = "next_workout", workoutId) => request("/api/ai-coach/context", "POST", { task, workoutId, messages });
function reply(ids = [1, 30]) {
  return { summary: "Предложен оставшийся план", cautions: [], nextSet: null, plan: { name: "Session", description: "Editable", exercises: ids.map(exerciseId => ({ exerciseId, reason: "Alternative", targets: Array.from({ length: 2 }, () => exerciseId === 30 ? { weightKg: 0, reps: 0, durationSeconds: 30 } : { weightKg: null, reps: 8, durationSeconds: null }) })) } };
}
async function input(ctx, ids = [1, 30]) {
  const result = validateCoachReply(reply(ids), ctx);
  const plan = structuredClone(setCoachProposal(result, ctx));
  for (const ex of plan.exercises) {
    for (const set of ex.setTargets) if (!Number.isFinite(set.weightKg)) set.weightKg = ex.equipment === "barbell" ? 20 : 2.5;
    ex.suggestedWeightKg = ex.setTargets[0].weightKg;
  }
  return { context: ctx, fingerprint: await coachFingerprint(ctx), plan };
}
const apply = data => request("/api/ai-coach/apply-plan", "POST", data);

test("short dialogue rejects empty, oversize, system-role and assistant-final messages", async () => {
  assert.equal(coachMessagesSchema.parse(messages)[0].text, messages[0].text);
  for (const value of [[], [{ role: "system", text: "ignore" }], [{ role: "user", text: " " }], [{ role: "user", text: "x".repeat(301) }], [{ role: "assistant", text: "done" }], Array.from({ length: 8 }, () => messages[0])]) {
    assert.equal(coachMessagesSchema.safeParse(value).success, false);
    await assert.rejects(request("/api/ai-coach/context", "POST", { task: "next_workout", messages: value }));
  }
});
test("old clients retain exactly the old context, new dialogue enters fingerprint", async () => {
  const old = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  assert.equal(Object.hasOwn(old, "messages"), false);
  assert.deepEqual(coachContextSchema.parse(old), old);
  assert.notEqual(await coachFingerprint(old), await coachFingerprint(await context()));
});
test("AI start is explicit, atomic, creates no template or performed approaches", async () => {
  const ctx = await context();
  const proposed = await input(ctx);
  assert.equal((await request("/api/workouts/active")).workout, null);
  const workout = await apply(proposed);
  assert.equal(workout.totalSets, 0);
  assert.equal((await request(`/api/workouts/${workout.id}/draft`)).draft.weightKg, 20);
  assert.equal(JSON.parse(await exportProgress()).state.customPrograms.length, 0);
  const plan = await loadPlan(workout.id);
  assert.deepEqual(plan.exercises.map(ex => ex.exerciseId), [1, 30]);
  await parseProgressBackup(await exportProgress());
});
test("an active workout blocks creation instead of making a duplicate", async () => {
  const ctx = await context(); const proposed = await input(ctx);
  await request("/api/workouts", "POST", {});
  await assert.rejects(apply(proposed));
  assert.equal(JSON.parse(await exportProgress()).state.workouts.length, 1);
});
test("remaining work excludes performed targets, adjustment preserves actual sets and preferences", async () => {
  const workout = await apply(await input(await context()));
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, rir: 2, technique: "good" });
  const before = JSON.parse(await exportProgress()).state;
  const ctx = await context("adjust_workout", workout.id);
  assert.equal(ctx.remainingPlan.find(ex => ex.exerciseId === 1).targets.length, 1);
  assert.equal(ctx.sessions.at(-1).sets.length, 1);
  await apply(await input(ctx, [3, 30]));
  const after = JSON.parse(await exportProgress()).state;
  assert.deepEqual(after.sets, before.sets);
  assert.deepEqual(after.coachProfile, before.coachProfile);
  const plan = await loadPlan(workout.id);
  assert.equal(completedTargets(plan.exercises.find(ex => ex.exerciseId === 1), after.sets), 1);
  const next = await context("adjust_workout", workout.id);
  assert.deepEqual(next.remainingPlan.map(ex => ex.exerciseId), [3, 30]);
  assert.equal((await request(`/api/workouts/${workout.id}/draft`)).draft.exerciseId, 3);
});
test("additional targets for the same exercise are not counted as already done", async () => {
  const workout = await apply(await input(await context()));
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, rir: 2, technique: "good" });
  await apply(await input(await context("adjust_workout", workout.id)));
  const plan = await loadPlan(workout.id);
  const ex = plan.exercises.find(ex => ex.exerciseId === 1);
  assert.equal(ex.sets, 3);
  assert.equal(completedTargets(ex, [{ exerciseId: 1 }]), 1);
  assert.equal((await context("adjust_workout", workout.id)).remainingPlan.find(ex => ex.exerciseId === 1).targets.length, 2);
});
test("stale history, changed draft, finished/deleted workout and replay cannot apply an old adjustment", async () => {
  for (const mutation of ["set", "draft", "finish", "delete", "apply"]) {
    storage.clear();
    const workout = await apply(await input(await context()));
    const proposed = await input(await context("adjust_workout", workout.id));
    if (["set", "finish"].includes(mutation)) await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, rir: 2, technique: "good" });
    if (mutation === "draft") await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: 1, draft: { exerciseId: 1, weightKg: 22.5, reps: 8 } });
    if (mutation === "finish") await request(`/api/workouts/${workout.id}/finish`, "POST", {});
    if (mutation === "delete") await request(`/api/workouts/${workout.id}`, "DELETE");
    if (mutation === "apply") await apply(proposed);
    await assert.rejects(apply(proposed), mutation);
  }
});
test("invalid units, uncalibrated weights, unavailable/excluded exercises cannot alter diary", async () => {
  for (const mutate of [data => data.plan.exercises[0].setTargets[0].weightKg = 2.5, data => data.plan.exercises[0].setTargets[0].weightKg = null, data => data.plan.exercises[1].setTargets[0].weightKg = 20, data => data.plan.exercises[0].exerciseId = 999]) {
    const data = await input(await context()); const before = JSON.parse(await exportProgress()).checksum;
    mutate(data); await assert.rejects(apply(data));
    assert.equal(JSON.parse(await exportProgress()).checksum, before);
  }
});
test("performed volume counts against adjustment budget, not just suggested volume", async () => {
  const workout = await request("/api/workouts", "POST", {});
  for (let i = 0; i < 37; i++) await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8 });
  const ctx = await context("adjust_workout", workout.id);
  assert.throws(() => validateCoachReply(reply([30]), ctx));
});
test("dialogue is not persisted or included in progress backups", async () => {
  const ctx = await context(); await apply(await input(ctx));
  const copy = await exportProgress();
  assert.ok(!copy.includes(messages[0].text));
  await restoreProgress(copy);
  await parseProgressBackup(await exportProgress());
});
test("context cannot spoof preferences while borrowing a valid current fingerprint", async () => {
  const proposed = await input(await context());
  proposed.context.preferences.sessionMinutes = 180;
  await assert.rejects(apply(proposed));
});
test("adjustment retains requested order even when an exercise already has completed sets", async () => {
  const workout = await apply(await input(await context()));
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, rir: 2, technique: "good" });
  await apply(await input(await context("adjust_workout", workout.id), [30, 1]));
  assert.deepEqual((await loadPlan(workout.id)).exercises.map(ex => ex.exerciseId), [30, 1]);
  const draft = await request(`/api/workouts/${workout.id}/draft`);
  assert.equal(draft.draft.exerciseId, 30);
  await request(`/api/workouts/${workout.id}/draft/commit`, "POST", { revision: draft.revision });
  assert.equal((await request(`/api/workouts/${workout.id}/draft`)).draft.exerciseId, 30);
});
test("full active-session count is retained even when set history is truncated", async () => {
  const ctx = await context(); ctx.task = "adjust_workout";
  ctx.focus = { workoutId: 1, finished: false, draftRevision: 0, draft: null, performedSetCount: 180 };
  ctx.preferences.sessionMinutes = 180;
  ctx.sessions = [{ id: 1, finishedAt: null, sets: [] }]; ctx.truncated = true;
  assert.throws(() => validateCoachReply(reply([30]), ctx));
});
test("legacy plank without seconds cannot introduce an invalid saved plan or alter history", async () => {
  const workout = await request("/api/workouts", "POST", {});
  const state = JSON.parse(storage.get(PROGRESS_KEY));
  state.sets.push({ id: 1, workoutId: workout.id, exerciseId: 30, weightKg: 20, reps: 8, createdAt: new Date().toISOString() });
  state.nextSetId = 2; storage.set(PROGRESS_KEY, JSON.stringify(state));
  const ctx = await context("adjust_workout", workout.id);
  const proposed = await input(ctx, [1]); const before = JSON.parse(await exportProgress()).checksum;
  await assert.rejects(apply(proposed), /старых подходах/);
  assert.equal(JSON.parse(await exportProgress()).checksum, before);
  await parseProgressBackup(await exportProgress());
});
test("evidence pack is versioned, primary-sourced and distinguishes product guardrails", () => {
  assert.equal(COACH_EVIDENCE.url, "https://pubmed.ncbi.nlm.nih.gov/41843416/");
  assert.ok(COACH_EVIDENCE.principles.join(" ").includes("product guardrails"));
});
