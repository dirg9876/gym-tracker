import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { requiredStrengthKg, liftForExercise } from "@workspace/level-data/strength";
const { setVolume, formatSetContext } = await import("../lib/workoutMeasurement.ts");
const { targetForExerciseLevel, levelFromExercises } = await import("../lib/levelProgress.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { exportProgress, parseProgressBackup, restoreProgress } = await import("../lib/progressBackup.ts");
beforeEach(() => storage.clear());
const start = () => request("/api/workouts", "POST", {});
const add = (id, exerciseId, weightKg, reps, extra = {}) => request(`/api/workouts/${id}/sets`, "POST", { exerciseId, weightKg, reps, ...extra });
const finish = id => request(`/api/workouts/${id}/finish`, "POST");
const hash = backup => { backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex"); return JSON.stringify(backup); };

test("each explicit exercise category is persisted, exported and restored; invalid category cannot create a row", async () => {
  for (const equipment of ["barbell", "dumbbell", "bodyweight", "machine", "other"]) {
    const created = await request("/api/exercises", "POST", { name: `Category ${equipment}`, muscleGroup: "Грудь", equipment });
    assert.equal(created.equipment, equipment);
  }
  const before = JSON.parse(await exportProgress());
  await assert.rejects(request("/api/exercises", "POST", { name: "Invalid", muscleGroup: "Ноги", equipment: "wheel" }), { status: 400 });
  assert.deepEqual(JSON.parse(await exportProgress()).state, before.state);
  await restoreProgress(await exportProgress());
  assert.deepEqual((await request("/api/exercises")).filter(ex => ex.isCustom).map(ex => ex.equipment).sort(), ["barbell", "bodyweight", "dumbbell", "machine", "other"]);
});

test("bodyweight tonnage includes body plus extra load, but never adds it to barbell/dumbbell or timed sets", () => {
  assert.equal(setVolume(0, 10, "bodyweight", 80), 800);
  assert.equal(setVolume(10, 8, "bodyweight", 80), 720);
  assert.equal(setVolume(20, 10, "barbell", 80), 200);
  assert.equal(setVolume(5, 10, "dumbbell", 80), 50);
  assert.equal(setVolume(0, 0, "bodyweight", 80, true), 0);
});

test("active, history, report, overview, progress and breakdown all use identical bodyweight volume", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const workout = await start();
  const first = await add(workout.id, 7, 0, 10);
  await add(workout.id, 7, 10, 8);
  await add(workout.id, 30, 0, 0, { durationSeconds: 30 });
  assert.equal(first.weightKg, 0);
  assert.equal(first.bodyWeightKg, 80);
  assert.equal(first.bodyWeightEstimated, false);
  assert.equal(first.volume, 800);
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalVolume, 1520);
  const report = await finish(workout.id);
  assert.equal(report.workout.totalVolume, 1520);
  assert.equal((await request("/api/workouts"))[0].totalVolume, 1520);
  assert.equal((await request("/api/stats/overview")).totalVolume, 1520);
  assert.equal((await request("/api/stats/progress")).points[0].volume, 1520);
  assert.equal((await request("/api/stats/exercises/7/progress")).points[0].volume, 1520);
  assert.equal((await request(`/api/workouts/${workout.id}/exercise-breakdown`)).items.find(ex => ex.exerciseId === 7).volume, 1520);
});

test("new set body mass is a historical snapshot, not silently rewritten when profile changes", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const workout = await start(); await add(workout.id, 7, 0, 10); await finish(workout.id);
  await request("/api/profile", "PUT", { bodyWeightKg: 90 });
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalVolume, 800);
  await restoreProgress(await exportProgress());
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets[0].bodyWeightKg, 80);
  const next = await start();
  assert.equal((await add(next.id, 7, 0, 10)).volume, 900);
});

test("legacy zero-extra-load history is recalculated using profile mass and clearly marked estimated", async () => {
  const workout = await start(); await add(workout.id, 7, 0, 10); await finish(workout.id);
  const raw = storage.get(PROGRESS_KEY);
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalVolume, 0);
  assert.match(formatSetContext((await request(`/api/workouts/${workout.id}`)).sets[0]), /не указан/);
  await request("/api/profile", "PUT", { bodyWeightKg: 75 });
  const result = await request(`/api/workouts/${workout.id}`);
  assert.equal(result.totalVolume, 750);
  assert.equal(result.sets[0].bodyWeightEstimated, true);
  assert.match(formatSetContext(result.sets[0]), /расчётный/);
  assert.deepEqual(JSON.parse(storage.get(PROGRESS_KEY)).sets, JSON.parse(raw).sets);
});

test("invalid body mass snapshots and body mass attached to non-bodyweight or timed sets cannot be imported", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const workout = await start(); await add(workout.id, 7, 0, 10);
  const original = await exportProgress();
  for (const change of [set => set.bodyWeightKg = 0, set => set.bodyWeightKg = "80", set => set.bodyWeightKg = 501, set => set.exerciseId = 3, set => { set.exerciseId = 30; set.reps = 0; set.durationSeconds = 30; }]) {
    const copy = JSON.parse(original); change(copy.state.sets[0]);
    await assert.rejects(parseProgressBackup(hash(copy)));
  }
  await parseProgressBackup(original);
});

test("any three accessories can raise a level; isMain is not a gate, and incomplete sessions do not count", async () => {
  const workout = await start();
  for (const id of [21, 24, 27]) await add(workout.id, id, 20, 8);
  assert.equal((await request("/api/levels")).currentLevel, 0);
  await finish(workout.id);
  const levels = await request("/api/levels");
  assert.ok(levels.currentLevel > 0);
  assert.deepEqual(new Set(levels.stats.mainExercises.slice(0, 3).map(ex => ex.exerciseId)), new Set([21, 24, 27]));
  assert.equal(levels.stats.mainExercises.length, 31);
});

test("one or two exercises, or many sets of one exercise, cannot replace three distinct exercises", async () => {
  const workout = await start();
  for (let i = 0; i < 5; i++) await add(workout.id, 3, 100, 8);
  await add(workout.id, 5, 100, 8); await finish(workout.id);
  assert.equal((await request("/api/levels")).currentLevel, 0);
  assert.equal(levelFromExercises([{ exerciseId: 1, achievedLevel: 80 }, { exerciseId: 1, achievedLevel: 80 }, { exerciseId: 2, achievedLevel: 80 }]), 0);
});

test("a mix of reps, seconds and weight can achieve level 80 using each full final target", async () => {
  const workout = await start();
  await add(workout.id, 7, 0, 25); await add(workout.id, 30, 0, 0, { durationSeconds: 180 });
  const custom = await request("/api/exercises", "POST", { name: "Custom machine", muscleGroup: "Ноги", equipment: "machine" });
  await add(workout.id, custom.id, custom.standard.entries.at(-1).target, 1); await finish(workout.id);
  const levels = await request("/api/levels");
  assert.equal(levels.currentLevel, 80);
  assert.equal(levels.nextLevel, null);
  assert.equal(levels.stats.mainExercises.find(ex => ex.exerciseId === 7).standard.unit, "reps");
  assert.equal(levels.stats.mainExercises.find(ex => ex.exerciseId === 30).standard.unit, "seconds");
  assert.equal(levels.stats.mainExercises.filter(ex => ex.achievedLevel === 80).length, 3);
});

test("every catalog threshold is monotone and every rank anchor remains exact, including official WRPF kg", async () => {
  for (const sex of ["male", "female"]) {
    await request("/api/profile", "PUT", { sex, bodyWeightKg: 75 });
    for (const ex of await request("/api/exercises")) {
      let previous = 0;
      for (let level = 1; level <= 80; level++) {
        const target = targetForExerciseLevel(ex.standard, ex.equipment, level);
        assert.ok(target >= previous); previous = target;
        if (ex.standard.official) assert.equal(target, requiredStrengthKg(liftForExercise(ex.name), level, 75, sex));
      }
      for (const entry of ex.standard.entries) assert.equal(targetForExerciseLevel(ex.standard, ex.equipment, entry.rank.minLevel), entry.target);
    }
  }
});

test("replacing a same-standard exercise preserves achievement; deleting history recalculates levels", async () => {
  const workout = await start(); for (const id of [21, 24, 27]) await add(workout.id, id, 20, 8); await finish(workout.id);
  const before = await request("/api/levels");
  await request("/api/exercises/21/replace", "POST", { targetExerciseId: 22 });
  assert.equal((await request("/api/levels")).currentLevel, before.currentLevel);
  assert.equal((await request("/api/levels")).stats.mainExercises.some(ex => ex.exerciseId === 21), false);
  assert.equal((await request("/api/levels")).stats.mainExercises.find(ex => ex.exerciseId === 22).archived, undefined);
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await request("/api/levels")).currentLevel, 0);
});
