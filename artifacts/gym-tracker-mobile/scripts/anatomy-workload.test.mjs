import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, beforeEach, afterEach, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { exerciseAnatomy, MUSCLES } = await import("../lib/exerciseAnatomy.ts");
const { weeklyMuscleWorkload } = await import("../lib/muscleWorkload.ts");
const { weeklyWork } = await import("../lib/trainingCoach.ts");
const { formatSetResult, formatSetContext } = await import("../lib/workoutMeasurement.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const now = new Date("2026-10-24T10:00:00Z");
beforeEach(() => { storage.clear(); mock.timers.enable({ apis: ["Date"], now: now.getTime() }); });
afterEach(() => mock.timers.reset());
const row = (exerciseName = "Жим штанги лёжа", extra = {}) => ({ exerciseName, muscleGroup: "Грудь", createdAt: "2026-10-22T10:00:00Z", reps: 10, ...extra });
test("all 31 default exercises have specific muscle roles and technique cues", async () => {
  const exercises = await request("/api/exercises");
  assert.equal(exercises.length, 31);
  for (const ex of exercises) {
    const info = exerciseAnatomy(ex);
    assert.equal(info.specific, true, ex.name); assert.ok(info.primary.length && info.cues.length >= 2);
    assert.equal(new Set([...info.primary, ...info.secondary, ...info.stabilizers]).size,
      info.primary.length + info.secondary.length + info.stabilizers.length, ex.name);
  }
});
test("offline vector data retains pinned source and full MIT license and contains every highlighted region", () => {
  const asset = JSON.parse(readFileSync(new URL("../assets/anatomy/muscles.json", import.meta.url), "utf8"));
  assert.match(asset.source, /\/tree\/[a-f0-9]{40}$/); assert.match(asset.license, /Copyright \(c\) 2022 ELABBASSI Hicham/);
  assert.match(asset.license, /THE SOFTWARE IS PROVIDED/);
  const slugs = new Set([...asset.front, ...asset.back].map(p => p.slug));
  for (const muscle of Object.keys(MUSCLES)) assert.ok(slugs.has(muscle), muscle);
  for (const part of [...asset.front, ...asset.back]) assert.ok(part.paths.length && part.paths.every(d => d.startsWith("M")));
  const component = readFileSync(new URL("../components/ExerciseAnatomy.tsx", import.meta.url), "utf8");
  assert.match(component, /translate\(-724 0\)/); assert.match(component, /width=\{diagramWidth\}/);
  assert.doesNotMatch(component, /width="100%"/);
});
test("spelling normalization and unknown custom exercises do not invent precise anatomy", () => {
  assert.deepEqual(exerciseAnatomy({ name: "  ЖИМ  ШТАНГИ ЛЕЖА ", muscleGroup: "Грудь" }), exerciseAnatomy({ name: "Жим штанги лёжа", muscleGroup: "Грудь" }));
  const unknown = exerciseAnatomy({ name: "Мой вариант", muscleGroup: "Ноги" });
  assert.equal(unknown.specific, false); assert.deepEqual(unknown.secondary, []); assert.match(unknown.note, /Общая схема/);
});
test("presses contribute direct chest and fractional triceps/delts, but stabilization is not counted as direct back work", () => {
  const rows = Array.from({ length: 3 }, () => row()), saved = structuredClone(rows);
  const result = weeklyMuscleWorkload(rows, now);
  const muscle = id => result.muscles.find(g => g.muscle === id);
  assert.equal(muscle("chest").direct, 3); assert.equal(muscle("triceps").indirect, 3);
  assert.equal(muscle("triceps").estimatedSets, 1.5); assert.equal(muscle("deltoids").days, 1);
  assert.equal(muscle("upper-back"), undefined); assert.deepEqual(rows, saved);
});
test("hinges, hamstring curls, leg extensions and calves are distinguished instead of one generic leg score", () => {
  const result = weeklyMuscleWorkload(["Румынская тяга", "Сгибания ног лёжа", "Разгибания ног сидя", "Подъёмы на носки"].map(name => row(name)), now);
  const direct = id => result.muscles.find(g => g.muscle === id).direct;
  assert.equal(direct("hamstring"), 2); assert.equal(direct("quadriceps"), 1); assert.equal(direct("calves"), 1);
  assert.ok(!result.muscles.some(g => g.muscle === "lower-back"));
});
test("isometric holds and unknown movements are explicit, never sold as dynamic effective sets", () => {
  const result = weeklyMuscleWorkload([row("Планка", { reps: 0, durationSeconds: 45 }), row("Своя тяга")], now);
  assert.equal(result.unspecifiedSets, 1);
  assert.ok(result.muscles.every(g => g.holds === 1 && g.estimatedSets === 0));
});
test("weekly counts use the session's local date, not approach-entry dates across midnight or the seven-day boundary", () => {
  const sets = [row(undefined, { workoutStartedAt: "2026-10-20T23:50:00+03:00", workoutFinishedAt: "2026-10-21T00:30:00+03:00", createdAt: "2026-10-20T23:55:00+03:00", exerciseId: 1, weightKg: 50 }),
    row(undefined, { workoutStartedAt: "2026-10-20T23:50:00+03:00", workoutFinishedAt: "2026-10-21T00:30:00+03:00", createdAt: "2026-10-21T00:10:00+03:00", exerciseId: 1, weightKg: 50 })];
  assert.equal(weeklyWork(sets, now)[0].trainingDays, 1);
  assert.equal(weeklyMuscleWorkload(sets, now).muscles[0].days, 1);
  const old = row(undefined, { workoutStartedAt: "2026-10-17T20:00:00Z", createdAt: "2026-10-19T01:00:00Z", workoutFinishedAt: "2026-10-19T02:00:00Z" });
  assert.deepEqual(weeklyMuscleWorkload([old], now).muscles, []);
});
test("future and corrupt finished sessions cannot enter weekly anatomy statistics", async () => {
  await request("/api/exercises");
  const raw = JSON.parse(storage.get(PROGRESS_KEY));
  raw.workouts.push({ id: 1, name: null, startedAt: "2026-10-22T10:00:00Z", finishedAt: "2026-11-01T10:00:00Z" });
  raw.sets.push({ id: 1, workoutId: 1, exerciseId: 1, weightKg: 50, reps: 10, createdAt: "2026-10-22T10:00:00Z" });
  raw.nextWorkoutId = 2; raw.nextSetId = 2;
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  const saved = new Map(storage), result = await request("/api/stats/weekly");
  assert.deepEqual(result.groups, []); assert.deepEqual(result.muscles, []); assert.deepEqual(storage, saved);
});
test("exercise detail retains assisted load, dumbbell count and bodyweight snapshots in best-set results", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const assisted = await request("/api/exercises", "POST", { name: "Тест противовеса", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  await request("/api/exercises/3", "PATCH", { dumbbellCount: 2 });
  const w = await request("/api/workouts", "POST");
  for (const [exerciseId, weightKg] of [[assisted.id, 30], [3, 20], [7, 0]]) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId, weightKg, reps: 10 });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  const a = (await request(`/api/stats/exercises/${assisted.id}/progress`)).points[0].topSet;
  assert.equal(a.loadMode, "assisted"); assert.equal(a.bodyWeightKg, 80); assert.match(formatSetResult(a), /Противовес 30/); assert.match(formatSetContext(a), /50 кг/);
  const d = (await request("/api/stats/exercises/3/progress")).points[0].topSet;
  assert.equal(d.dumbbellCount, 2); assert.match(formatSetResult(d), /2 × 20/);
  const b = (await request("/api/stats/exercises/7/progress")).points[0].topSet;
  assert.equal(b.durationSeconds, undefined); assert.match(formatSetContext(b), /Вес тела 80/);
});
