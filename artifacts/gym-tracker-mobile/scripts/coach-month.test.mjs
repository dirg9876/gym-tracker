import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { coachMonthSchema, defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
beforeEach(() => storage.clear());
const target = { weightKg: 0, reps: 0, durationSeconds: 30 };
const session = () => ({ name: "Core", description: "Controlled volume", exercises: [{ exerciseId: 30, reason: "Core work", targets: [{ ...target }, { ...target }] }] });
const monthly = () => ({ name: "Four weeks", overview: "Progress based on reported performance, not automatic loads", daysPerWeek: 3, templates: [session()], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Recovery and consistency", sessions: [0, 0, 0] })) });
const ctx = (task = "month_plan", trainingMode, workoutId) => request("/api/ai-coach/context", "POST", { task, trainingMode, workoutId });
async function saveMonth(context, value = monthly()) {
  context ??= await ctx();
  return request("/api/ai-coach/month", "PUT", { context, fingerprint: await coachFingerprint(context), monthly: value });
}
async function start(context, plan = session()) {
  const reply = validateCoachReply({ summary: "Session", cautions: [], nextSet: null, plan }, context);
  const converted = setCoachProposal(reply, context);
  return request("/api/ai-coach/apply-plan", "POST", { context, fingerprint: await coachFingerprint(context), plan: converted });
}
test("simplified personal settings have no hidden exclusions and default to 60-90 minutes", async () => {
  assert.equal(defaultCoachProfile().sessionMinutes, 75);
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), excludedExerciseIds: [1, 30], sessionMinutes: 15 });
  const profile = await request("/api/ai-coach/profile");
  assert.deepEqual(profile.excludedExerciseIds, []); assert.equal(profile.sessionMinutes, 60);
  const context = await ctx(); assert.deepEqual(context.preferences.excludedExerciseIds, []);
});
test("office constraints keep recent gym history but allow only bodyweight with no extra load", async () => {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8 });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  const context = await ctx("next_workout", "office");
  assert.equal(context.preferences.sessionMinutes, 20); assert.deepEqual(context.preferences.equipment, ["bodyweight"]);
  assert.equal(context.sessions.at(-1).sets[0].exerciseId, 1);
  for (const exerciseId of [1, 3, 10]) {
    const bad = session(); bad.exercises = [{ exerciseId, reason: "Invalid office equipment", targets: [{ weightKg: 0, reps: 8, durationSeconds: null }] }];
    assert.throws(() => validateCoachReply({ summary: "Bad", cautions: [], nextSet: null, plan: bad }, context));
  }
  const good = session(); good.exercises = [{ exerciseId: 7, reason: "Bar", targets: [{ weightKg: 0, reps: 3, durationSeconds: null }] }];
  assert.doesNotThrow(() => validateCoachReply({ summary: "Office", cautions: [], nextSet: null, plan: good }, context));
  good.exercises[0].targets[0].weightKg = null;
  assert.equal(validateCoachReply({ summary: "Office", cautions: [], nextSet: null, plan: good }, context).plan.exercises[0].targets[0].weightKg, 0);
});
test("office workouts retain office mode after restart/context rebuild and do not consume monthly slots", async () => {
  await saveMonth(); const context = await ctx("next_workout", "office");
  const workout = await start(context);
  const activeContext = await ctx("adjust_workout", undefined, workout.id);
  assert.equal(activeContext.trainingMode, "office"); assert.deepEqual(activeContext.preferences.equipment, ["bodyweight"]);
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, ...target });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  assert.equal((await ctx("next_workout")).scheduled.slot, 0);
});
test("monthly schedule rejects missing/duplicate weeks, bad template indices and wrong frequency", async () => {
  const context = await ctx();
  for (const mutate of [value => value.weeks.pop(), value => value.weeks[1].week = 1, value => value.weeks[0].sessions[0] = 3, value => value.weeks[0].sessions.pop(), value => value.daysPerWeek = 4]) {
    const value = monthly(); mutate(value); await assert.rejects(saveMonth(context, value));
  }
  assert.equal(await request("/api/ai-coach/month"), null);
});
test("month is explicit, persists in v8 and round-trips with no performed sets created", async () => {
  const saved = await saveMonth(); assert.equal(saved.slots.length, 12);
  const backup = await exportProgress(); assert.equal(JSON.parse(backup).version, 10);
  assert.equal(JSON.parse(backup).state.workouts.length, 0);
  await restoreProgress(backup);
  assert.deepEqual((await request("/api/ai-coach/month")).saved, saved.saved);
  assert.equal((await ctx("next_workout")).scheduled.slot, 0);
});
test("next regular workout receives the next scheduled session and completion advances exactly once", async () => {
  await saveMonth(); const context = await ctx("next_workout");
  assert.equal(context.scheduled.week, 1); assert.equal(context.scheduled.plan.name, "Core");
  const workout = await start(context);
  assert.equal((await ctx("next_workout")).scheduled.slot, 0);
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, ...target });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  assert.equal((await ctx("next_workout")).scheduled.slot, 1);
  const progress = await request("/api/ai-coach/month"); assert.equal(progress.slots.filter(slot => slot.completed).length, 1);
  await restoreProgress(await exportProgress()); assert.equal((await ctx("next_workout")).scheduled.slot, 1);
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await ctx("next_workout")).scheduled.slot, 0);
});
test("all four weeks can be completed and the next request does not reuse a completed slot", async () => {
  await saveMonth();
  for (let i = 0; i < 12; i++) {
    const context = await ctx("next_workout"); assert.equal(context.scheduled.slot, i);
    const workout = await start(context);
    await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, ...target });
    await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  }
  assert.equal((await ctx("next_workout")).scheduled, undefined);
  assert.equal((await request("/api/ai-coach/month")).slots.filter(slot => slot.completed).length, 12);
});
test("saving a month or changing goals/history invalidates outstanding next-session proposals", async () => {
  const before = await ctx("next_workout"); await saveMonth();
  await assert.rejects(start(before));
  const proposal = await ctx();
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "strength" });
  await assert.rejects(saveMonth(proposal));
});
test("unavailable exercises and wrong weight/time units cannot enter a saved month", async () => {
  const context = await ctx();
  for (const mutate of [value => value.templates[0].exercises[0].exerciseId = 999, value => value.templates[0].exercises[0].targets[0].weightKg = 20, value => value.templates[0].exercises[0].targets[0].reps = 8]) {
    const value = monthly(); mutate(value); await assert.rejects(saveMonth(context, value));
  }
});
test("monthly exercises require replacement and keep the next session usable", async () => {
  await saveMonth();
  await assert.rejects(request("/api/exercises/30", "DELETE"), { status: 409 });
  const replacement = await request("/api/exercises/30/replace", "POST", { exercise: { name: "Боковая планка", muscleGroup: "Пресс", equipment: "bodyweight" } });
  assert.equal((await ctx("next_workout")).scheduled.plan.exercises[0].exerciseId, replacement.id);
  assert.equal((await request("/api/ai-coach/month")).slots[0].unavailable, false);
  await parseProgressBackup(await exportProgress());
  assert.ok(await request("/api/ai-coach/month"));
});

test("month replacement merges duplicate targets without losing scheduled sessions or sets", async () => {
  const side = await request("/api/exercises", "POST", { name: "Боковая планка", muscleGroup: "Пресс", equipment: "bodyweight" });
  const month = monthly();
  month.templates[0].exercises.push({ exerciseId: side.id, reason: "Side hold", targets: [{ ...target, durationSeconds: 45 }] });
  await saveMonth(undefined, month);
  await request("/api/exercises/30/replace", "POST", { targetExerciseId: side.id });
  const saved = await request("/api/ai-coach/month");
  assert.equal(saved.slots.length, 12);
  assert.equal(saved.saved.plan.templates[0].exercises.length, 1);
  assert.deepEqual(saved.saved.plan.templates[0].exercises[0].targets.map(set => set.durationSeconds), [30, 30, 45]);
  const context = await ctx("next_workout");
  assert.equal(context.scheduled.plan.exercises.length, 1);
  await start(context, context.scheduled.plan);
  await parseProgressBackup(await exportProgress());
});

test("monthly replacement beyond six targets fails atomically and suggests a separate replacement", async () => {
  const side = await request("/api/exercises", "POST", { name: "Боковая планка", muscleGroup: "Пресс", equipment: "bodyweight" });
  const month = monthly();
  month.templates[0].exercises.push({ exerciseId: side.id, reason: "Side hold", targets: Array.from({ length: 5 }, () => ({ ...target })) });
  await saveMonth(undefined, month);
  const before = new Map(storage);
  await assert.rejects(request("/api/exercises/30/replace", "POST", { targetExerciseId: side.id }), { status: 409 });
  assert.deepEqual(storage, before);
  await request("/api/exercises/30/replace", "POST", { exercise: { name: "Планка", muscleGroup: "Пресс", equipment: "bodyweight" } });
  await parseProgressBackup(await exportProgress());
});
test("invalid persisted monthly relations are quarantined instead of loaded silently", async () => {
  await saveMonth(); const state = JSON.parse(storage.get(PROGRESS_KEY));
  state.coachMonth.plan.templates[0].exercises[0].exerciseId = 999;
  storage.set(PROGRESS_KEY, JSON.stringify(state));
  await assert.rejects(request("/api/ai-coach/month"));
});
test("older backup versions remain accepted, absent month has no side effects", async () => {
  await request("/api/ai-coach/month");
  const original = JSON.parse(await exportProgress());
  for (const version of [1, 2, 3, 4, 5, 6, 7]) await parseProgressBackup(JSON.stringify({ ...original, version }));
  assert.equal(await request("/api/ai-coach/month"), null);
  assert.equal(coachMonthSchema.safeParse(monthly()).success, true);
});
test("removing the monthly plan leaves completed workouts and their performed sets intact", async () => {
  await saveMonth(); const workout = await start(await ctx("next_workout"));
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, ...target });
  await request(`/api/workouts/${workout.id}/finish`, "POST", {});
  const before = JSON.parse(await exportProgress()).state;
  await request("/api/ai-coach/month", "DELETE");
  assert.equal(await request("/api/ai-coach/month"), null);
  const after = JSON.parse(await exportProgress()).state;
  assert.deepEqual(after.workouts, before.workouts); assert.deepEqual(after.sets, before.sets);
  await parseProgressBackup(await exportProgress());
});
