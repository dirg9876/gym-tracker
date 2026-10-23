import assert from "node:assert/strict";
import { storage, request } from "./testHarness.mjs";
import { beforeEach, test } from "node:test";
import { getLevelLabels } from "@workspace/level-data";
import { DISCIPLINES, msmcTarget, rankNorms, requiredStrengthKg, strengthLevel, weightClass, WRPF_RANKS } from "@workspace/level-data/strength";

const { isExercisePassed } = await import("../lib/levelProgress.ts");
const { formatKg, formatNumber } = await import("../lib/format.ts");
const { nextRankHint, exerciseRankHint } = await import("../lib/rankHint.ts");
const { templateFromWorkout, plannedSet, withSetTargets } = await import("../lib/workoutTemplates.ts");
const { exportProgress, parseProgressBackup, restoreProgress, getBackupStatus } = await import("../lib/progressBackup.ts");
const { savePlan, loadPlan } = await import("../lib/programPlanStash.ts");
const { PROGRESS_KEY, PLAN_PREFIX, PENDING_RESTORE_KEY } = await import("../lib/progressStorage.ts");
beforeEach(() => { storage.clear(); globalThis.__failMultiSetOnce = false; });

test("fractional training weights stay exact on screen", () => {
  assert.equal(formatKg(2.5), "2,5 кг");
  assert.equal(formatNumber(12.5), "12,5");
});

test("live weight hints use the next exact rank, profile and category; never accessory norms", async () => {
  const male = await request("/api/exercises/1/norms");
  const hint = nextRankHint(male, 20);
  assert.equal(hint.rank.code, "III_RAZRYAD");
  assert.equal(hint.kgTarget, 82.5);
  assert.equal(hint.remainingKg, 62.5);
  for (const [index, entry] of male.rankNorms.slice(1).entries()) {
    const exact = nextRankHint(male, entry.kgTarget);
    const next = male.rankNorms[index + 2];
    assert.equal(exact.rank.code, (next ?? entry).rank.code);
    assert.equal(exact.atMaximum, !next);
  }
  assert.equal(nextRankHint(male, 160).remainingKg, 0);
  await request("/api/profile", "PUT", {sex:"female", bodyWeightKg:60});
  const female = await request("/api/exercises/1/norms");
  assert.equal(nextRankHint(female,20).kgTarget,40);
  await request("/api/profile", "PUT", {bodyWeightKg:60.1});
  assert.equal(nextRankHint(await request("/api/exercises/1/norms"),20).kgTarget,45);
  for (const id of [3,7,30]) assert.equal(nextRankHint(await request(`/api/exercises/${id}/norms`),20),null);
  assert.equal(nextRankHint(undefined,20),null);
  assert.equal(nextRankHint(male,NaN),null);
});

for (const sex of ["male", "female"]) {
  test(`all 81 ${sex} level names and descriptions match the shared catalog`, async () => {
    await request("/api/profile", "PUT", { sex });
    const { levels } = await request("/api/levels");
    const labels = getLevelLabels(sex);
    assert.equal(levels.length, 81);
    assert.equal(new Set(labels.map(([name]) => name)).size, 81);
    assert.equal(new Set(labels.map(([, description]) => description)).size, 81);
    assert.deepEqual(levels.map(({ name, description }) => [name, description]), labels);
    assert.equal(levels[0].name, sex === "male" ? "Новичок" : "Феечка");
    assert.equal(levels[4].name, sex === "male" ? "Чувак у стойки" : "Золушка");
    assert.equal(levels[80].name, sex === "male" ? "Атлас" : "Легенда");
  });
}

test("changing profile labels preserves completed workouts and statistics", async () => {
  const workout = await request("/api/workouts", "POST", { name: "Test" });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const before = await request("/api/stats/overview");
  await request("/api/profile", "PUT", { sex: "female" });
  assert.deepEqual(await request("/api/stats/overview"), before);
  assert.equal((await request("/api/workouts"))[0].totalVolume, 200);
  assert.equal((await request("/api/workouts/active")).workout, null);
  assert.equal(before.totalWorkouts, 1);
  assert.equal(before.bestTonnage, 200);
  assert.equal(before.bestReps, 10);
  await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 }), { status: 409 });
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await request("/api/stats/overview")).totalWorkouts, 0);
});

test("parallel set additions retain every set with a unique ID", async () => {
  const workout = await request("/api/workouts", "POST");
  await Promise.all(Array.from({ length: 8 }, () => request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 })));
  const saved = await request(`/api/workouts/${workout.id}`);
  assert.equal(saved.sets.length, 8);
  assert.equal(new Set(saved.sets.map(({ id }) => id)).size, 8);
  assert.equal(saved.totalVolume, 1600);
});

test("invalid weights and repetitions never enter saved statistics", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const [weightKg, reps] of [[-5, 10], [null, 10], ["abc", 10], [20, 0], [20, -1], [20, 1.5]]) {
    await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg, reps }), { status: 400 });
  }
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 0);
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 7, weightKg: 0, reps: 10 });
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 1);
});

test("level progress uses individual requirements, not the rounded 0 kg benchmark", async () => {
  const levels = await request("/api/levels");
  const dumbbell = levels.stats.mainExercises.find((exercise) => exercise.name === "Жим штанги лёжа");
  assert.equal(levels.levels[1].benchmarkKg, 0);
  assert.equal(dumbbell.requiredKgForNextLevel, 20);
  assert.equal(isExercisePassed(dumbbell, levels.bodyWeightKg), false);
  assert.equal(isExercisePassed({ ...dumbbell, maxWeightKg: 20, bestValue: 20, hasRecordedResult: true }, levels.bodyWeightKg), true);
});

test("tonnage alone cannot raise a level when main exercise requirements are missing", async () => {
  const exercises = await request("/api/exercises");
  for (const exercise of exercises.filter((item) => item.isMain)) {
    await request(`/api/exercises/${exercise.id}`, "PATCH", { isMain: false });
  }
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 100, reps: 100 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.equal((await request("/api/levels")).currentLevel, 0);
});

test("earned levels survive elapsed time, reset tonnage and recalculate after deleting history", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const exerciseId of [1, 6, 12]) {
    await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, weightKg: 20, reps: 10 });
  }
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const earned = await request("/api/levels");
  assert.equal(earned.currentLevel, 1);
  assert.equal((await request("/api/levels")).currentLevel, 1);
  const key = "gym-tracker:offline-api:v1";
  const state = JSON.parse(storage.get(key));
  const old = new Date(Date.now() - 30 * 86400000).toISOString();
  state.sets.forEach((set) => { set.createdAt = old; });
  state.workouts.forEach((item) => { item.startedAt = old; item.finishedAt = old; });
  storage.set(key, JSON.stringify(state));
  assert.equal((await request("/api/levels")).currentLevel, 1);
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await request("/api/levels")).currentLevel, 0);
});

test("real WRPF categories use exact boundaries including open categories", () => {
  assert.equal(msmcTarget("bench", 75, "male"), 155);
  assert.equal(msmcTarget("squat", 75, "male"), 222.5);
  assert.equal(msmcTarget("deadlift", 75, "male"), 237.5);
  assert.equal(msmcTarget("bench", 75.01, "male"), 167.5);
  assert.equal(msmcTarget("bench", 60, "female"), 77.5);
  assert.equal(msmcTarget("squat", 60, "female"), 130);
  assert.equal(msmcTarget("deadlift", 60, "female"), 150);
  assert.equal(weightClass(141, "male").label, "140+");
  assert.equal(weightClass(91, "female").label, "90+");
  assert.equal(msmcTarget("bench", 141, "male"), 215);
  assert.equal(msmcTarget("bench", 500, "male"), 215);
});

test("all sexes, categories and levels are monotonic; 80 requires every full MSMC norm", () => {
  for (const sex of ["male", "female"]) {
    for (const kg of [44,48,52,56,60,67.5,75,82.5,90,100,110,125,140,141,200]) {
      const results = Object.fromEntries(DISCIPLINES.map(({lift}) => [lift, msmcTarget(lift, kg, sex)]));
      assert.equal(strengthLevel(results, kg, sex), 80);
      for (const {lift} of DISCIPLINES) {
        assert.ok(strengthLevel({...results, [lift]: results[lift] - 0.01}, kg, sex) < 80);
        const ranks = rankNorms(lift, kg, sex);
        assert.equal(ranks.at(-1).kgTarget, results[lift]);
        for (let index = 1; index < ranks.length; index++) assert.ok(ranks[index].kgTarget > ranks[index-1].kgTarget);
        let previous = 0;
        for (let level = 1; level <= 80; level++) {
          const target = requiredStrengthKg(lift, level, kg, sex);
          assert.ok(target >= previous && target >= 20);
          previous = target;
        }
      }
    }
  }
});

test("game rank milestones exactly match each published WRPF rank, not MSMC percentages", () => {
  for (const sex of ["male", "female"]) for (const kg of [44,52,60,75,75.01,90,141]) {
    for (const {lift} of DISCIPLINES) {
      for (const {rank, kgTarget} of rankNorms(lift, kg, sex).slice(1)) {
        assert.equal(requiredStrengthKg(lift, rank.minLevel, kg, sex), kgTarget);
      }
      assert.equal(requiredStrengthKg(lift, 1, kg, sex), 20);
    }
  }
  assert.equal(requiredStrengthKg("bench", WRPF_RANKS[1].minLevel, 75, "male"), 82.5);
  assert.equal(requiredStrengthKg("bench", WRPF_RANKS[4].minLevel, 75, "male"), 117.5);
});

test("barbell total weight below the 20 kg bar is rejected while dumbbells remain fractional", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const exerciseId of [1,2,6,8,12,13,19,23,26]) {
    for (const weightKg of [0,2.5,17.5,19.99]) await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId, weightKg, reps:10}), {status:400});
    await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId, weightKg:20, reps:10});
  }
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:3, weightKg:2.5, reps:10});
});

test("planks use explicit seconds end to end, with no fake kilograms, reps or weight records", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const durationSeconds of [30,60]) await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:30, weightKg:0, reps:0, durationSeconds});
  const current = await request(`/api/workouts/${workout.id}`);
  assert.equal(current.durationSeconds, 90);
  assert.equal(current.totalVolume, 0);
  assert.equal(current.totalReps, 0);
  const report = await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.equal(report.workout.durationSeconds, 90);
  assert.equal(report.exerciseBreakdown[0].durationSeconds, 90);
  assert.deepEqual(report.newExerciseRecords, []);
  const progress = await request("/api/stats/exercises/30/progress");
  assert.equal(progress.points[0].durationSeconds, 90);
  assert.equal(progress.points[0].maxDurationSeconds, 60);
  assert.equal(progress.points[0].topSet.durationSeconds, 60);
  const stats = await request("/api/stats/overview");
  assert.equal(stats.durationSeconds, 90);
  assert.equal(stats.topExercises[0].durationSeconds, 90);
  assert.equal((await request("/api/stats/progress")).points[0].durationSeconds, 90);
  assert.equal((await request("/api/workouts"))[0].durationSeconds, 90);
  const heatmap = await request("/api/stats/heatmap?days=7");
  assert.equal(heatmap.activeDays, 1);
  const backup = await exportProgress();
  assert.equal(JSON.parse(backup).version, 11);
  await restoreProgress(backup);
  assert.equal((await request(`/api/workouts/${workout.id}`)).durationSeconds, 90);
});

test("timed fields cannot be confused with repetitions or used in another exercise", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const body of [
    {exerciseId:30,weightKg:20,reps:10}, {exerciseId:30,weightKg:0,reps:1,durationSeconds:30},
    {exerciseId:30,weightKg:5,reps:0,durationSeconds:30}, {exerciseId:30,weightKg:0,reps:0,durationSeconds:0},
    {exerciseId:30,weightKg:0,reps:0,durationSeconds:1.5}, {exerciseId:30,weightKg:0,reps:0,durationSeconds:86401},
    {exerciseId:29,weightKg:0,reps:10,durationSeconds:30},
  ]) await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", body), {status:400});
  for (const exerciseId of [4,7,28,29,31]) await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId,weightKg:0,reps:10});
  assert.equal((await request(`/api/workouts/${workout.id}`)).totalReps, 50);
});

test("old plank entries are preserved without inventing a duration from old reps", async () => {
  const workout = await request("/api/workouts", "POST");
  const state = JSON.parse(storage.get(PROGRESS_KEY));
  state.sets.push({id:1,workoutId:workout.id,exerciseId:30,weightKg:20,reps:10,createdAt:new Date().toISOString()});
  state.nextSetId=2;
  storage.set(PROGRESS_KEY,JSON.stringify(state));
  const saved = await request(`/api/workouts/${workout.id}`);
  assert.equal(saved.durationSeconds,0);
  assert.equal(saved.totalVolume,0);
  assert.equal(saved.totalReps,0);
  const backup = await parseProgressBackup(await exportProgress());
  assert.equal(backup.state.sets[0].weightKg,20);
  assert.equal(backup.state.sets[0].reps,10);
  assert.equal(backup.state.sets[0].durationSeconds,undefined);
});

test("no auto-passes, fake accessory ranks, active records or favorite-based bypasses", async () => {
  assert.equal((await request("/api/levels")).currentLevel, 0);
  for (const id of [1,6,12]) await request(`/api/exercises/${id}`, "PATCH", {isMain:false});
  const workout = await request("/api/workouts", "POST");
  for (const [exerciseId, weightKg] of [[1,155],[12,222.5],[6,237.5]]) {
    await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId,weightKg,reps:1});
  }
  assert.equal((await request("/api/levels")).currentLevel, 0);
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const result = await request("/api/levels");
  assert.equal(result.currentLevel, 80);
  assert.equal(result.currentRank.code, "MSMC");
  assert.equal(result.nextLevel, null);
  assert.equal((await request("/api/exercises/3/norms")).mcKg, null);
  assert.deepEqual((await request("/api/exercises/3/norms")).rankNorms, []);
});

test("backup round-trip preserves profile, custom exercises, programs, active workout and plan", async () => {
  await request("/api/profile", "PUT", { sex: "female", bodyWeightKg: 62.5, heightCm: 170 });
  const exercise = await request("/api/exercises", "POST", { name: "Свое упражнение", muscleGroup: "Спина", equipment: "dumbbell" });
  const program = await request("/api/programs", "POST", {
    name: "Своя программа", description: "Проверка",
    exercises: [{ exerciseId: exercise.id, sets: 3, repsMin: 8, repsMax: 12, intent: "hypertrophy", note: "Контроль" }],
  });
  const workout = await request("/api/workouts", "POST", { name: "По программе" });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: exercise.id, weightKg: 12.5, reps: 10 });
  const plan = await request(`/api/programs/${program.id}`);
  await savePlan(workout.id, plan);
  const exported = await exportProgress();
  const original = await parseProgressBackup(exported);
  await request("/api/profile", "PUT", { sex: "male", bodyWeightKg: 90 });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: exercise.id, weightKg: 30, reps: 10 });
  await restoreProgress(exported);
  const restored = await parseProgressBackup(await exportProgress());
  assert.deepEqual(restored.state, original.state);
  assert.deepEqual(restored.plans, original.plans);
  assert.deepEqual(await loadPlan(workout.id), plan);
  const previous = await parseProgressBackup((await getBackupStatus()).recovery);
  assert.equal(previous.state.profile.bodyWeightKg, 90);
  assert.equal(previous.state.sets.length, 2);
});

test("damaged, unrelated and future backup files do not change current progress", async () => {
  await request("/api/profile");
  const text = await exportProgress();
  const snapshot = new Map(storage);
  for (const invalid of ["{broken", "{}", JSON.stringify({...JSON.parse(text), version:99}), text.replace('"confirmedLevel": 0', '"confirmedLevel": 80')]) {
    await assert.rejects(restoreProgress(invalid));
    assert.deepEqual(storage, snapshot);
  }
});

test("version 1 backups remain importable after adding timed sets", async () => {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:1, weightKg:20, reps:10});
  const original = JSON.parse(await exportProgress());
  original.version = 1;
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:30, weightKg:0, reps:0, durationSeconds:60});
  await restoreProgress(JSON.stringify(original));
  const restored = await request(`/api/workouts/${workout.id}`);
  assert.equal(restored.totalSets, 1);
  assert.equal(restored.totalVolume, 200);
  assert.equal(restored.durationSeconds, 0);
});

test("restore rolls back a partial storage failure and remains usable", async () => {
  await request("/api/profile");
  const older = await exportProgress();
  await request("/api/profile", "PUT", { bodyWeightKg: 92.5 });
  const before = storage.get(PROGRESS_KEY);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(restoreProgress(older), /Simulated/);
  assert.equal(storage.get(PROGRESS_KEY), before);
  assert.equal(storage.has(PENDING_RESTORE_KEY), false);
  await restoreProgress(older);
  assert.equal((await request("/api/profile")).bodyWeightKg, null);
});

test("a pending restore journal is recovered on the next storage operation", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const before = storage.get(PROGRESS_KEY);
  storage.set(PENDING_RESTORE_KEY, JSON.stringify([[PROGRESS_KEY, before]]));
  storage.set(PROGRESS_KEY, "{partial");
  storage.set(PLAN_PREFIX + "999", "{}");
  assert.equal((await request("/api/profile")).bodyWeightKg, 80);
  assert.equal(storage.has(PLAN_PREFIX + "999"), false);
  assert.equal(storage.has(PENDING_RESTORE_KEY), false);
});

test("export waits for queued saves and unrelated storage survives import", async () => {
  const workout = await request("/api/workouts", "POST");
  storage.set("unrelated-key", "preserve");
  const writes = Array.from({ length: 20 }, () => request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 22.5, reps: 10 }));
  const text = await exportProgress();
  await Promise.all(writes);
  assert.equal((await parseProgressBackup(text)).state.sets.length, 20);
  await restoreProgress(text);
  assert.equal(storage.get("unrelated-key"), "preserve");
});

test("backup schema rejects duplicate IDs and dangling references even with a valid checksum", async () => {
  await request("/api/profile");
  const original = JSON.parse(await exportProgress());
  const { createHash } = await import("node:crypto");
  for (const mutate of [
    (state) => state.exercises.push(state.exercises[0]),
    (state) => { state.sets = [{ id: 1, workoutId: 999, exerciseId: 1, weightKg: 20, reps: 10, createdAt: new Date().toISOString() }]; state.nextSetId = 2; },
  ]) {
    const backup = structuredClone(original);
    mutate(backup.state);
    backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex");
    await assert.rejects(restoreProgress(JSON.stringify(backup)), /связи/);
  }
});

test("workout types are empty by default and contain only saved user templates after restore", async () => {
  assert.deepEqual(await request("/api/programs"), { programs: [] });
  const template = await request("/api/programs", "POST", {
    name: "Мой вид тренировки",
    exercises: [{ exerciseId: 1, sets: 1, repsMin: 10, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg: 20, reps: 10 }] }],
  });
  assert.deepEqual((await request("/api/programs")).programs, [template]);
  await restoreProgress(await exportProgress());
  assert.deepEqual((await request("/api/programs")).programs, [template]);
  await request(`/api/programs/${template.id}`, "DELETE");
  assert.deepEqual(await request("/api/programs"), { programs: [] });
});

test("legacy program links remain usable and respect the empty bar", async () => {
  for (const id of ["chest", "back", "legs", "shoulders", "arms", "push", "pull", "fullbody"]) {
    const plan = await request(`/api/programs/${id}`);
    assert.ok(plan.exercises.length > 0);
    for (const exercise of plan.exercises) {
      if (exercise.equipment === "bodyweight") assert.equal(exercise.suggestedWeightKg, 0);
      else if (exercise.equipment === "barbell") assert.ok(exercise.suggestedWeightKg >= 20);
      else assert.ok(exercise.suggestedWeightKg > 0);
    }
  }
});

test("a large history survives export and import without truncation", async () => {
  const workout = await request("/api/workouts", "POST");
  const state = JSON.parse(storage.get(PROGRESS_KEY));
  state.sets = Array.from({ length: 5000 }, (_, index) => ({
    id: index + 1, workoutId: workout.id, exerciseId: 1, weightKg: 22.5,
    reps: 10, createdAt: new Date().toISOString(),
  }));
  state.nextSetId = 5001;
  storage.set(PROGRESS_KEY, JSON.stringify(state));
  const text = await exportProgress();
  await restoreProgress(text);
  const saved = await request(`/api/workouts/${workout.id}`);
  assert.equal(saved.totalSets, 5000);
  assert.equal(saved.totalVolume, 1125000);
});

test("deleting a planned workout leaves backup relations intact", async () => {
  const workout = await request("/api/workouts", "POST");
  await savePlan(workout.id, await request("/api/programs/fullbody"));
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal(await loadPlan(workout.id), null);
  assert.deepEqual((await parseProgressBackup(await exportProgress())).plans, {});
});

test("profile validation rejects invalid norm parameters without changing data", async () => {
  const original = await request("/api/profile");
  for (const body of [{bodyWeightKg:0},{bodyWeightKg:19},{bodyWeightKg:501},{bodyWeightKg:"75"},{sex:"unknown"}]) {
    await assert.rejects(request("/api/profile", "PUT", body), {status:400});
    assert.deepEqual(await request("/api/profile"), original);
  }
});

test("exercise picker hints use personal results and exact next rank without per-row requests", async () => {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:1,weightKg:30,reps:10});
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const exercises = await request("/api/exercises");
  const profile = await request("/api/profile");
  const bench = exercises.find(ex => ex.id === 1);
  assert.equal(exerciseRankHint(bench, profile).remaining, 52.5);
  assert.equal(exerciseRankHint(bench, profile, 82.5).rank.code, "II_RAZRYAD");
  assert.equal(exerciseRankHint(exercises.find(ex => ex.id === 3),profile).standard.official, false);
  assert.equal(exerciseRankHint({...bench,isCustom:true},profile).standard.official, false);
  assert.equal(exerciseRankHint(undefined,profile), null);
});

test("completed workouts become editable templates with exact individual sets and seconds", async () => {
  const source = await request("/api/workouts", "POST", {name:"Source"});
  const rows = [
    {exerciseId:1,weightKg:20,reps:10}, {exerciseId:1,weightKg:22.5,reps:8},
    {exerciseId:1,weightKg:30,reps:6}, {exerciseId:30,weightKg:0,reps:0,durationSeconds:45},
    {exerciseId:30,weightKg:0,reps:0,durationSeconds:60},
  ];
  for (const row of rows) await request(`/api/workouts/${source.id}/sets`, "POST", row);
  const finished = (await request(`/api/workouts/${source.id}/finish`, "POST")).workout;
  const original = structuredClone(finished);
  const exercises = templateFromWorkout(finished);
  assert.deepEqual(exercises[0].setTargets.map(set => set.weightKg),[20,22.5,30]);
  assert.deepEqual(exercises[1].setTargets.map(set => set.durationSeconds),[45,60]);
  const template = await request("/api/programs", "POST", {name:"Repeat",exercises});
  let plan = await request(`/api/programs/${template.id}`);
  assert.deepEqual(plan.exercises[0].setTargets,exercises[0].setTargets);
  assert.equal(plan.exercises[0].suggestedWeightKg,20);
  assert.equal(plan.exercises[1].repsMin,45);
  const changed = withSetTargets(plan.exercises[0],[{weightKg:25,reps:12},{weightKg:32.5,reps:6}]);
  await request(`/api/programs/${template.id}`, "PUT", {name:"Repeat edited",exercises:[changed,plan.exercises[1]]});
  plan = await request(`/api/programs/${template.id}`);
  assert.equal(plan.exercises[0].sets,2);
  assert.deepEqual(plannedSet(plan.exercises[0],0),{weightKg:25,reps:12,setType:"working"});
  assert.deepEqual(plannedSet(plan.exercises[0],1),{weightKg:32.5,reps:6,setType:"working"});
  assert.equal(plannedSet(plan.exercises[1],1).durationSeconds,60);
  const repeat = await request("/api/workouts", "POST", {name:plan.name,programId:template.id});
  assert.equal(repeat.totalSets,0);
  assert.deepEqual(await loadPlan(repeat.id),plan);
  assert.deepEqual(await request(`/api/workouts/${source.id}`),original);
  await request(`/api/workouts/${repeat.id}/sets`, "POST", {exerciseId:1,weightKg:27.5,reps:12});
  const before = await exportProgress();
  await restoreProgress(before);
  assert.deepEqual(await loadPlan(repeat.id),plan);
  assert.deepEqual((await request(`/api/programs/${template.id}`)).exercises,plan.exercises);
  assert.equal((await request(`/api/workouts/${repeat.id}`)).totalSets,1);
  assert.equal((await request("/api/stats/overview")).totalWorkouts,1);
  await request(`/api/programs/${template.id}`, "DELETE");
  assert.deepEqual(await request(`/api/workouts/${source.id}`),original);
  assert.deepEqual(await loadPlan(repeat.id),plan);
  await parseProgressBackup(await exportProgress());
});

test("starting a plan is atomic and never replaces an existing active workout plan", async () => {
  await request("/api/profile");
  const before = new Map(storage);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(request("/api/workouts", "POST", {programId:"fullbody"}), /Simulated/);
  assert.deepEqual(storage,before);
  const workout = await request("/api/workouts", "POST", {programId:"fullbody"});
  const plan = await loadPlan(workout.id);
  const same = await request("/api/workouts", "POST", {programId:"missing"});
  assert.equal(same.id,workout.id);
  assert.deepEqual(await loadPlan(workout.id),plan);
  assert.equal((await request("/api/workouts")).length,1);
});

test("invalid template weights, counts, durations and references cannot corrupt progress", async () => {
  await request("/api/profile");
  const before = new Map(storage);
  const base = {exerciseId:1,sets:1,repsMin:10,repsMax:10,intent:"hypertrophy",setTargets:[{weightKg:20,reps:10}]};
  for (const exercise of [
    {...base,sets:2}, {...base,exerciseId:999}, {...base,setTargets:[{weightKg:2.5,reps:10}]},
    {...base,setTargets:[{weightKg:20,reps:1.5}]}, {...base,setTargets:[{weightKg:0,reps:0,durationSeconds:30}]},
    {...base,exerciseId:30}, {...base,exerciseId:30,setTargets:[{weightKg:0,reps:0,durationSeconds:0}]},
  ]) {
    await assert.rejects(request("/api/programs", "POST", {name:"Bad",exercises:[exercise]}),{status:400});
    assert.deepEqual(storage,before);
  }
  const unfinished = await request("/api/workouts", "POST");
  assert.throws(() => templateFromWorkout(unfinished), /завершите/);
  assert.throws(() => templateFromWorkout({...unfinished,finishedAt:new Date().toISOString(),sets:[{exerciseId:30,exerciseName:"Планка",weightKg:20,reps:10}]}), /не указано время/);
});

test("version 2 backups still restore timed sets after the template format update", async () => {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:30,weightKg:0,reps:0,durationSeconds:45});
  const backup = JSON.parse(await exportProgress());
  backup.version = 2;
  await restoreProgress(JSON.stringify(backup));
  assert.equal((await request(`/api/workouts/${workout.id}`)).durationSeconds,45);
});

test("all catalog exercises have unit-correct standards; only three lifts are official", async () => {
  for (const sex of ["male","female"]) {
    for (const bodyWeightKg of [44,60,75,90,150]) {
      await request("/api/profile", "PUT", {sex,bodyWeightKg});
      const profile = await request("/api/profile");
      const exercises = await request("/api/exercises");
      assert.equal(exercises.filter(ex => ex.standard.official).length,3);
      for (const exercise of exercises) {
        const standard = exercise.standard;
        assert.equal(standard.entries.length,6);
        assert.equal(standard.unit,exercise.name === "Планка" ? "seconds" : exercise.equipment === "bodyweight" ? "reps" : "kg");
        for (const [i,entry] of standard.entries.entries()) {
          assert.ok(Number.isFinite(entry.target) && entry.target > 0);
          if (i > 0) assert.ok(entry.target >= standard.entries[i-1].target);
          if (exercise.equipment === "barbell") assert.ok(entry.target >= 20);
        }
        const hint = exerciseRankHint(exercise,profile,0);
        assert.equal(hint.target,standard.entries[0].target);
        assert.equal(hint.standard.official,standard.official);
      }
      const bench = exercises.find(ex => ex.id === 1).standard;
      const dumbbell = exercises.find(ex => ex.id === 3).standard;
      for (let i=0;i<6;i++) assert.equal(dumbbell.entries[i].target,Math.ceil(bench.entries[i].target*.28/2.5-1e-9)*2.5);
    }
  }
});

test("rep and timed ranks use best single sets, never accumulated repetitions or kilograms", async () => {
  const workout = await request("/api/workouts", "POST");
  for (let i=0;i<4;i++) await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:7,weightKg:0,reps:3});
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:30,weightKg:0,reps:0,durationSeconds:60});
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:30,weightKg:0,reps:0,durationSeconds:30});
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const exercises = await request("/api/exercises");
  const pullups = exercises.find(ex=>ex.id===7), plank = exercises.find(ex=>ex.id===30);
  assert.equal(pullups.rankBest,3);
  assert.equal(pullups.userRank,null);
  assert.equal(plank.rankBest,60);
  assert.equal(plank.userRank.code,"I_RAZRYAD");
  assert.equal(plank.standard.official,false);
  assert.equal((await request("/api/levels")).currentLevel,0);
});

test("deleting an exercise used by a template cannot leave a broken backup", async () => {
  const exercise = await request("/api/exercises","POST",{name:"Custom",muscleGroup:"Грудь",equipment:"dumbbell"});
  await request("/api/programs","POST",{name:"Custom plan",exercises:[{exerciseId:exercise.id,sets:1,repsMin:10,repsMax:10,intent:"hypertrophy",setTargets:[{weightKg:10,reps:10}]}]});
  await request(`/api/exercises/${exercise.id}`,"DELETE");
  assert.equal((await request("/api/programs/1")).exercises.length,0);
  await parseProgressBackup(await exportProgress());
});

test("progress selects the best rep or timed set regardless of order or added weight", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const set of [
    {exerciseId:7,weightKg:20,reps:3}, {exerciseId:7,weightKg:0,reps:8},
    {exerciseId:7,weightKg:0,reps:5},
    {exerciseId:30,weightKg:0,reps:0,durationSeconds:30},
    {exerciseId:30,weightKg:0,reps:0,durationSeconds:90},
    {exerciseId:30,weightKg:0,reps:0,durationSeconds:45},
  ]) await request(`/api/workouts/${workout.id}/sets`, "POST", set);
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const pullups = await request("/api/stats/exercises/7/progress");
  const plank = await request("/api/stats/exercises/30/progress");
  assert.equal(pullups.points[0].topSet.reps,8);
  assert.equal(pullups.exercise.rankBest,8);
  assert.equal(plank.points[0].topSet.durationSeconds,90);
  assert.equal(plank.exercise.rankBest,90);
});

test("invalid template backup targets cannot replace progress even with a valid checksum", async () => {
  const template = await request("/api/programs", "POST", {
    name:"Protected",exercises:[{exerciseId:1,sets:1,repsMin:10,repsMax:10,intent:"hypertrophy",setTargets:[{weightKg:20,reps:10}]}],
  });
  const workout = await request("/api/workouts", "POST", {programId:template.id});
  const original = JSON.parse(await exportProgress());
  const before = new Map(storage);
  const { createHash } = await import("node:crypto");
  for (const mutate of [
    backup => { backup.state.customPrograms[0].exercises[0].setTargets[0].weightKg = 2.5; },
    backup => { backup.plans[workout.id].exercises[0].setTargets[0] = {weightKg:0,reps:0,durationSeconds:30}; },
    backup => { backup.state.customPrograms[0].exercises[0].sets = 2; },
  ]) {
    const backup = structuredClone(original);
    mutate(backup);
    backup.checksum = createHash("sha256").update(JSON.stringify({state:backup.state,plans:backup.plans})).digest("hex");
    await assert.rejects(restoreProgress(JSON.stringify(backup)));
    assert.deepEqual(storage,before);
  }
});

test("custom exercise editing preserves its ID, recorded results and backup relations", async () => {
  const exercise = await request("/api/exercises", "POST", {name:"Custom press",muscleGroup:"Грудь",equipment:"dumbbell"});
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:exercise.id,weightKg:10,reps:12});
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const before = await request(`/api/workouts/${workout.id}`);
  const edited = await request(`/api/exercises/${exercise.id}`, "PATCH", {name:"Renamed press",muscleGroup:"Плечи",equipment:"dumbbell"});
  assert.equal(edited.id,exercise.id);
  assert.equal(edited.name,"Renamed press");
  assert.equal(edited.muscleGroup,"Плечи");
  assert.equal(edited.rankBest,10);
  assert.equal(edited.standard.official,false);
  const after = await request(`/api/workouts/${workout.id}`);
  assert.equal(after.totalVolume,before.totalVolume);
  assert.equal(after.sets[0].id,before.sets[0].id);
  assert.equal(after.sets[0].exerciseName,"Renamed press");
  await restoreProgress(await exportProgress());
  assert.equal((await request("/api/exercises")).find(ex => ex.id === exercise.id).name,"Renamed press");
});

test("exercise editor rejects invalid labels and changes to built-in norm identity", async () => {
  const exercise = await request("/api/exercises", "POST", {name:"Custom",muscleGroup:"Грудь",equipment:"other"});
  const before = new Map(storage);
  for (const data of [{name:" "},{muscleGroup:""},{name:123},{name:"X".repeat(121)},{equipment:"invalid"}]) {
    await assert.rejects(request(`/api/exercises/${exercise.id}`, "PATCH", data),{status:400});
    assert.deepEqual(storage,before);
  }
  for (const data of [{name:"Other bench"}]) {
    await assert.rejects(request("/api/exercises/1", "PATCH", data),{status:409});
    assert.deepEqual(storage,before);
  }
});

test("used exercises cannot change measurement semantics or delete recorded progress", async () => {
  const exercise = await request("/api/exercises", "POST", {name:"Custom",muscleGroup:"Пресс",equipment:"other"});
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", {exerciseId:exercise.id,weightKg:10,reps:12});
  const before = new Map(storage);
  for (const data of [{name:"Планка"}]) {
    await assert.rejects(request(`/api/exercises/${exercise.id}`, "PATCH", data),{status:409});
    assert.deepEqual(storage,before);
  }
  const workoutBefore = await request(`/api/workouts/${workout.id}`);
  await assert.rejects(request(`/api/exercises/${exercise.id}`, "DELETE"), { status: 409 });
  assert.deepEqual(await request(`/api/workouts/${workout.id}`),workoutBefore);
  await parseProgressBackup(await exportProgress());
});

test("category changes recalibrate referenced templates but still protect seconds versus repetitions", async () => {
  const exercise = await request("/api/exercises", "POST", {name:"Custom",muscleGroup:"Грудь",equipment:"other"});
  const edited = await request(`/api/exercises/${exercise.id}`, "PATCH", {equipment:"dumbbell"});
  assert.equal(edited.equipment,"dumbbell");
  const template = await request("/api/programs", "POST", {name:"Custom plan",exercises:[{exerciseId:exercise.id,sets:1,repsMin:10,repsMax:10,intent:"hypertrophy",setTargets:[{weightKg:10,reps:10}]}]});
  await request(`/api/exercises/${exercise.id}`, "PATCH", {equipment:"barbell"});
  const workout = await request("/api/workouts", "POST", {programId:template.id});
  await request(`/api/programs/${template.id}`, "DELETE");
  await assert.rejects(request(`/api/exercises/${exercise.id}`, "PATCH", {name:"Планка"}),{status:409});
  assert.equal((await loadPlan(workout.id)).exercises[0].setTargets[0].weightKg,20);
  await parseProgressBackup(await exportProgress());
});
