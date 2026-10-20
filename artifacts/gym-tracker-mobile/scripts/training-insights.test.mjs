import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { spawnSync } from "node:child_process";
import { storage, request } from "./testHarness.mjs";
const { buildTrainingInsights } = await import("../lib/trainingInsights.ts");
const { exerciseLevelGoal, targetForExerciseLevel } = await import("../lib/levelProgress.ts");
const { exerciseStandard, standardProgress } = await import("../lib/exerciseStandards.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const now = new Date(2026, 9, 19, 12);
const exercise = (id = 1, name = "Жим штанги лёжа", equipment = "barbell") => ({ id, name, muscleGroup: "Грудь", equipment, isCustom: false, isMain: true });
const session = (id, days = 0, finished = true) => ({ id, startedAt: new Date(2026, 9, 19 + days, 9).toISOString(), finishedAt: finished ? new Date(2026, 9, 19 + days, 10).toISOString() : null });
const set = (id, workoutId, extra = {}) => ({ id, workoutId, exerciseId: 1, exerciseName: "Жим штанги лёжа", muscleGroup: "Грудь", equipment: "barbell", weightKg: 20, reps: 10, volume: 200, createdAt: session(workoutId).startedAt, ...extra });
beforeEach(() => storage.clear());

test("insights count only finished nonfuture sessions, include zero-load sets and preserve their input", () => {
  const workouts = [session(1), session(2, -1), session(3, 0, false), session(4, 1), { ...session(5), startedAt: "bad" }];
  const sets = [set(1, 1, { weightKg: 0 }), set(2, 2), set(3, 3), set(4, 4), set(5, 999)];
  const before = JSON.stringify({ workouts, sets });
  const result = buildTrainingInsights(workouts, sets, [exercise()], 28, now);
  assert.deepEqual(result.totals, { workouts: 2, sets: 2, days: 2 });
  assert.equal(result.calendar.length, 28);
  assert.equal(result.calendar.at(-1).workouts, 1);
  assert.equal(result.groups[0].sets, 2);
  assert.equal(JSON.stringify({ workouts, sets }), before);
});

test("period edges and the previous equal calendar period are disjoint", () => {
  const workouts = [session(1, -27), session(2, -28), session(3, -55), session(4, -56)];
  const result = buildTrainingInsights(workouts, workouts.map(row => set(row.id, row.id)), [exercise()], 28, now);
  assert.equal(result.from, "2026-09-22");
  assert.deepEqual(result.totals, { workouts: 1, sets: 1, days: 1 });
  assert.deepEqual(result.previous, { workouts: 2, sets: 2, days: 2 });
  assert.equal(result.weeks.reduce((sum, row) => sum + row.sets, 0), 1);
  assert.ok(result.weeks[0].partial);
});

test("several sessions in one day never multiply active days or muscle-group days", () => {
  const workouts = [session(1, -1), session(2, -1)];
  const sets = [set(1, 1), set(2, 2), set(3, 2, { exerciseId: 2, muscleGroup: "Ноги" })];
  const result = buildTrainingInsights(workouts, sets, [exercise(), { ...exercise(2), muscleGroup: "Ноги" }], 28, now);
  assert.deepEqual(result.totals, { workouts: 2, sets: 3, days: 1 });
  assert.equal(result.calendar.find(row => row.workouts).workouts, 2);
  assert.equal(result.groups.reduce((sum, row) => sum + row.sets, 0), 3);
  assert.ok(result.groups.every(row => row.days === 1));
});

test("local calendar includes each day exactly once across both DST transitions", () => {
  const child = spawnSync(process.execPath, ["--import", new URL("./testHarness.mjs", import.meta.url).href, "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    const { buildTrainingInsights } = await import(${JSON.stringify(new URL("../lib/trainingInsights.ts", import.meta.url).href)});
    for (const date of [new Date(2026, 2, 10, 12), new Date(2026, 10, 3, 12)]) {
      const result = buildTrainingInsights([], [], [], 84, date);
      assert.equal(result.calendar.length, 84);
      assert.equal(new Set(result.calendar.map(row => row.date)).size, 84);
      assert.equal(result.weeks.flatMap(week => result.calendar.filter(day => day.date >= week.from && day.date <= week.to)).length, 84);
    }
  `], { env: { ...process.env, TZ: "America/New_York" }, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
});

test("alltime data are not limited to50 workouts; only the dated calendar/weekly window is capped", () => {
  const workouts = Array.from({ length: 120 }, (_, i) => session(i + 1, -i));
  const result = buildTrainingInsights(workouts, workouts.map(row => set(row.id, row.id)), [exercise()], null, now);
  assert.equal(result.totals.workouts, 120);
  assert.equal(result.exercises[0].series.find(row => row.id === "weight").points.length, 120);
  assert.equal(result.previous, null);
  assert.equal(result.calendar.length, 84);
  assert.equal(result.weeks.reduce((sum, row) => sum + row.workouts, 0), 84);
});

test("time/rep/weight and assistance series keep their own units and actual top sets", () => {
  const workouts = [session(1, -1), session(2)];
  const exercises = [exercise(), exercise(2, "Планка", "bodyweight"), exercise(3, "Подтягивания", "bodyweight"), exercise(4, "Гравитрон", "machine")];
  const sets = [set(1, 1), set(2, 2, { weightKg: 25, reps: 8 }),
    set(3, 1, { exerciseId: 2, durationSeconds: 0, reps: 0 }), set(4, 2, { exerciseId: 2, durationSeconds: 45, reps: 0 }),
    set(5, 1, { exerciseId: 3, weightKg: 0, reps: 8 }), set(6, 2, { exerciseId: 3, weightKg: 0, reps: 12 }),
    set(7, 1, { exerciseId: 4, loadMode: "assisted", weightKg: 40 }), set(8, 1, { exerciseId: 4, loadMode: "assisted", weightKg: 35 }),
    set(9, 2, { exerciseId: 4, loadMode: "assisted", weightKg: 25 }), set(10, 2, { exerciseId: 4, weightKg: 50 })];
  const result = buildTrainingInsights(workouts, sets, exercises, 28, now);
  const get = id => result.exercises.find(row => row.exercise.id === id);
  assert.deepEqual(get(1).series.find(row => row.id === "weight").points.map(row => [row.value, row.set.reps]), [[20, 10], [25, 8]]);
  assert.deepEqual(get(2).series.map(row => row.unit), ["seconds"]);
  assert.equal(get(2).unknownTimeSets, 1);
  assert.deepEqual(get(2).series[0].points.map(row => row.value), [45]);
  assert.equal(get(3).defaultMetric, "reps");
  assert.equal(get(3).series.some(row => row.id === "weight"), false);
  assert.deepEqual(get(3).series.find(row => row.id === "reps").points.map(row => row.value), [8, 12]);
  assert.equal(get(4).series.find(row => row.id === "assistance").lowerIsBetter, true);
  assert.deepEqual(get(4).series.find(row => row.id === "assistance").points.map(row => row.value), [35, 25]);
  assert.deepEqual(get(4).series.find(row => row.id === "weight").points.map(row => row.value), [50]);
});

test("empty data stays honest and results have no archive state; bad periods fail", () => {
  const empty = buildTrainingInsights([], [], [], 28, now);
  assert.deepEqual(empty.totals, { workouts: 0, sets: 0, days: 0 });
  assert.equal(empty.calendar.filter(row => row.workouts).length, 0);
  assert.deepEqual(empty.exercises, []);
  const data = buildTrainingInsights([session(1)], [set(1, 1)], [exercise()], 28, now);
  assert.equal(data.exercises[0].archived, undefined);
  for (const period of [0, 1, 29, "28", Infinity]) assert.throws(() => buildTrainingInsights([], [], [], period, now));
});

test("level gap uses the next game target, not the next rank; unknown result is not a zero record", () => {
  for (const ex of [exercise(), exercise(2, "Планка", "bodyweight"), exercise(3, "Подтягивания", "bodyweight")]) {
    const standard = exerciseStandard(ex, { sex: "male", bodyWeightKg: 75 });
    const target = targetForExerciseLevel(standard, ex.equipment, 4);
    const stat = { standard, equipment: ex.equipment, bestValue: target - 1, hasRecordedResult: true };
    assert.equal(exerciseLevelGoal(stat, 4).remaining, 1);
    assert.notEqual(standardProgress(standard, target - 1).target, target);
    assert.equal(exerciseLevelGoal({ ...stat, bestValue: target }, 4).passed, true);
    assert.equal(exerciseLevelGoal({ ...stat, hasRecordedResult: false }, 4).remaining, null);
    assert.equal(exerciseLevelGoal({ ...stat, bestValue: standard.entries.at(-1).target }, 80).remaining, 0);
  }
});

test("local insights endpoint is read-only, excludes the active session and retains replaced history", async () => {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const active = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${active.id}/sets`, "POST", { exerciseId: 1, weightKg: 30, reps: 10 });
  await request("/api/exercises/1/replace", "POST", { targetExerciseId: 2 });
  const before = storage.get(PROGRESS_KEY);
  const data = await request("/api/stats/insights?days=all");
  assert.deepEqual(data.totals, { workouts: 1, sets: 1, days: 1 });
  assert.equal(data.exercises[0].archived, undefined);
  assert.equal(data.exercises[0].exercise.id, 2);
  assert.equal(data.exercises[0].series[0].points[0].value, 20);
  assert.equal(storage.get(PROGRESS_KEY), before);
  await assert.rejects(request("/api/stats/insights?days=invalid"), { status: 400 });
  assert.equal(storage.get(PROGRESS_KEY), before);
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await request("/api/stats/insights?days=all")).totals.workouts, 0);
});
