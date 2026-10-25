import assert from "node:assert/strict";
import { test, beforeEach, afterEach, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { claimWorkoutCelebration } = await import("../lib/workoutCelebration.ts");
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
beforeEach(() => { storage.clear(); globalThis.__storageFault = undefined; mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-25T09:00:00Z") }); });
afterEach(() => { mock.timers.reset(); globalThis.__storageFault = undefined; });
const set = (weightKg = 50, reps = 10, extra = {}) => ({ exerciseId: 1, weightKg, reps, rir: 2, technique: "good", ...extra });
async function record(rows = [set()]) {
  const w = await request("/api/workouts", "POST");
  for (const row of rows) { await request(`/api/workouts/${w.id}/sets`, "POST", row); mock.timers.tick(60000); }
  await request(`/api/workouts/${w.id}/finish`, "POST"); mock.timers.tick(3600000);
  return request(`/api/workouts/${w.id}/recap`);
}
test("first completion has a full read-only recap, not a pile of unearned PRs", async () => {
  const recap = await record([set(), set(), set()]);
  assert.equal(recap.workout.totalSets, 3); assert.equal(recap.workout.totalReps, 30); assert.equal(recap.elapsedMinutes, 3);
  assert.equal(recap.records, 0); assert.equal(recap.firstExercises, 1); assert.equal(recap.exercises[0].status, "first");
  assert.equal(recap.feedback.rirKnown, 3); assert.equal(recap.exercises[0].best.weightKg, 50); assert.ok(recap.exercises[0].next);
  const before = new Map(storage); assert.deepEqual(await request(`/api/workouts/${recap.workout.id}/recap`), recap); assert.deepEqual(storage, before);
});
test("new load and matched-weight repetitions get distinct factual records", async () => {
  await record(); const heavier = await record([set(55, 8)]);
  assert.equal(heavier.records, 1); assert.match(heavier.exercises[0].change, /\+5 кг/); assert.equal(heavier.exercises[0].previous.best.weightKg, 50);
  const reps = await record([set(55, 10)]); assert.equal(reps.records, 1); assert.match(reps.exercises[0].change, /8 → 10/);
  assert.equal(reps.exercises[0].previous.best.reps, 8);
});
test("longer training or more low-load sets do not produce artificial strength records", async () => {
  await record([set(60, 12)]); const recap = await record(Array.from({ length: 6 }, () => set(50, 10)));
  assert.equal(recap.records, 0); assert.equal(recap.workout.totalSets, 6); assert.equal(recap.exercises[0].status, "changed");
});
test("technique warnings suppress congratulations about a new load; missing RIR remains unknown", async () => {
  await record(); const recap = await record([set(70, 8, { technique: "breakdown", rir: null }), set(50, 10, { rir: 0 })]);
  assert.equal(recap.records, 0); assert.equal(recap.feedback.breakdown, 1); assert.equal(recap.feedback.failure, 1);
  assert.equal(recap.feedback.rirKnown, 1); assert.equal(recap.exercises[0].status, "attention");
});
test("timed records use seconds, not kilograms or repetitions", async () => {
  const hold = seconds => set(0, 0, { exerciseId: 30, durationSeconds: seconds, rir: null });
  await record([hold(30)]); const recap = await record([hold(45)]);
  assert.equal(recap.records, 1); assert.match(recap.exercises[0].change, /15 с/); assert.equal(recap.workout.totalReps, 0);
  assert.equal(recap.feedback.repSets, 0); assert.equal(recap.exercises[0].next, null);
});
test("legacy plank without a measured time is not a timed record or a known baseline", async () => {
  const first = await record([set(0, 0, { exerciseId: 30, durationSeconds: 30, rir: null })]);
  const raw = state(); delete raw.sets[0].durationSeconds; raw.sets[0].reps = 10; storage.set(PROGRESS_KEY, JSON.stringify(raw));
  const legacy = await request(`/api/workouts/${first.workout.id}/recap`);
  assert.equal(legacy.records, 0); assert.match(legacy.exercises[0].change, /не указано время/);
  assert.equal(legacy.repetitions, 0); assert.equal(state().sets[0].reps, 10);
});
test("assistance is not a max-weight record and bodyweight is preserved", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const ex = await request("/api/exercises", "POST", { name: "Recap assisted", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  await record([set(30, 8, { exerciseId: ex.id })]); const recap = await record([set(25, 8, { exerciseId: ex.id })]);
  assert.equal(recap.records, 0); assert.equal(recap.exercises[0].best.bodyWeightKg, 80); assert.equal(recap.exercises[0].best.loadMode, "assisted");
  assert.match(recap.exercises[0].change, /Противовес/); assert.equal(recap.exercises[0].next, null);
});
test("a pair of dumbbells is not silently compared to one dumbbell, while corrected barbell category keeps identity", async () => {
  await record([set(10, 10, { exerciseId: 3 })]); await request("/api/exercises/3", "PATCH", { dumbbellCount: 2 });
  const pair = await record([set(12.5, 10, { exerciseId: 3 })]);
  assert.equal(pair.records, 0); assert.equal(pair.exercises[0].status, "changed"); assert.equal(pair.exercises[0].best.dumbbellCount, 2);
  await record(); await request("/api/exercises/1", "PATCH", { equipment: "other" });
  const corrected = await record([set(55, 10)]); assert.equal(corrected.records, 1);
});
test("recap remains available after backup/cold restart and corrections recalculate it without rewriting history", async () => {
  await record(); const recap = await record([set(55, 10)]), backup = await exportProgress();
  await restoreProgress(backup); assert.deepEqual(await request(`/api/workouts/${recap.workout.id}/recap`), recap);
  const row = recap.workout.sets[0]; await request(`/api/sets/${row.id}`, "PATCH", { revision: 0, values: { weightKg: 45, reps: 8, rir: 2, technique: "good" } });
  const fresh = await request(`/api/workouts/${recap.workout.id}/recap`);
  assert.equal(fresh.records, 0); assert.equal(fresh.workout.totalReps, 8); assert.equal(fresh.exercises[0].best.createdAt, row.createdAt);
  assert.equal(state().sets[0].weightKg, 50);
});
test("records in later sessions cannot change the achievements of an earlier workout", async () => {
  await record(); const second = await record([set(55, 10)]); await record([set(80, 10)]);
  const before = await request(`/api/workouts/${second.workout.id}/recap`);
  assert.equal(before.records, 1); assert.equal(before.exercises[0].previous.best.weightKg, 50);
});
test("offset timestamps are ordered by real instants, not ISO spelling", async () => {
  await record(); const raw = state(); raw.workouts[0].startedAt = "2026-10-25T12:00:00.000+03:00";
  storage.set(PROGRESS_KEY, JSON.stringify(raw)); const current = await record([set(55, 10)]);
  assert.equal(current.records, 1); assert.equal(current.exercises[0].previous.best.weightKg, 50);
});
test("missing and active workouts fail distinctly and an empty finished session has no achievements", async () => {
  await assert.rejects(request("/api/workouts/99999/recap"), { status: 404 });
  const active = await request("/api/workouts", "POST"); await assert.rejects(request(`/api/workouts/${active.id}/recap`), { status: 409 });
  await request(`/api/workouts/${active.id}/finish`, "POST"); const recap = await request(`/api/workouts/${active.id}/recap`);
  assert.equal(recap.records, 0); assert.equal(recap.exercises.length, 0); assert.equal(recap.workout.totalSets, 0);
});
test("celebration claims are idempotent across concurrent mounts and outside all progress/backup data", async () => {
  await request("/api/exercises"); const before = await exportProgress(), at = new Date().toISOString();
  const first = claimWorkoutCelebration(1, at), second = claimWorkoutCelebration(1, at);
  assert.equal(await first, true); assert.equal(await second, false); assert.equal(await claimWorkoutCelebration(1, at), false);
  assert.equal(await exportProgress(), before);
});
test("corrupt UI markers and storage failures fail closed without blocking report data", async () => {
  storage.set("gym-beam:celebrated-workouts:v1", "invalid"); assert.equal(await claimWorkoutCelebration(1, new Date().toISOString()), false);
  storage.clear(); globalThis.__storageFault = event => { if (event.operation === "setItem") throw new Error("Full"); };
  assert.equal(await claimWorkoutCelebration(1, new Date().toISOString()), false); globalThis.__storageFault = undefined;
  assert.equal(await claimWorkoutCelebration(1, new Date().toISOString()), true);
});
