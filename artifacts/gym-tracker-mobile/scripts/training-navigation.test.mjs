import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, beforeEach, afterEach, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { buildExerciseTimeline } = await import("../lib/exerciseTimeline.ts");
beforeEach(() => { storage.clear(); mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-24T10:00:00Z") }); });
afterEach(() => mock.timers.reset());
const source = name => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
test("Training embeds one exercise library and keeps templates separate without adding a second start button", () => {
  const screen = source("app/(tabs)/programs.tsx"), tabs = source("app/(tabs)/_layout.tsx");
  assert.match(tabs, /title: "Тренировки"/); assert.doesNotMatch(tabs, /Виды\\nтренировок/);
  assert.match(screen, /<ExerciseLibrary embedded/); assert.match(screen, /label: "Шаблоны"/);
  assert.match(screen, /useState<TrainingView>\(validView\(params.view\) \? params.view : "plan"\)/);
  assert.match(screen, /<TrainingPlanOverview/);
  assert.doesNotMatch(screen, /Начать тренировку|start-workout|Управление упражнениями/);
});
test("library and weekly shortcuts open the exercise progress; active workout anatomy stays on its original route", () => {
  assert.match(source("components/ExerciseLibrary.tsx"), /\?view=progress/);
  assert.match(source("components/WeeklyTraining.tsx"), /\?view=progress/);
  assert.match(source("app/workout/[id]/index.tsx"), /router\.push\(`\/exercises\/\$\{selectedExerciseId\}`\)/);
  assert.match(source("app/exercises/index.tsx"), /<ExerciseLibrary/);
});
test("exercise progress contains the unified history-plus-forecast chart and complete paginated journal, not just best sets", () => {
  const detail = source("app/exercises/[id].tsx"), journal = source("components/ExerciseJournal.tsx");
  assert.match(detail, /params\.view === "progress"/);
  for (const component of ["ExerciseProgressChart", "ExerciseJournal", "ExerciseOutlook", "ExerciseAnatomy", "ExerciseWeightStep"]) assert.match(detail, new RegExp(`<${component}`));
  assert.match(journal, /session\.sets\.map/); assert.match(journal, /item\.history\.slice\(historyPage \* 5/);
  assert.match(journal, /formatSetResult\(set\)/); assert.match(journal, /formatSetContext\(set\)/);
});
test("statistics keeps three focused views and lazy body-weight loading without requesting all exercise forecasts", () => {
  const stats = source("app/(tabs)/stats.tsx");
  for (const label of ["Обзор", "Нагрузка", "Вес тела"]) assert.ok(stats.includes(`label: "${label}"`));
  assert.doesNotMatch(stats, /\/api\/stats\/outlook|ExerciseOutlook|ExercisePicker|ExerciseJournal/);
  assert.match(stats, /enabled: view === "overview"/); assert.match(stats, /enabled: view === "body"/);
  assert.match(stats, /\/api\/stats\/body-weight/); assert.match(stats, /<WeeklyTraining/);
});
function record(raw, id, date, exerciseId = 1, equipment = "barbell", count = 3) {
  const timestamp = `${date}T10:00:00Z`;
  raw.workouts.push({ id, name: null, startedAt: timestamp, finishedAt: timestamp });
  for (let i = 0; i < count; i++) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId, weightKg: 50, reps: 10,
    equipment, rir: 2, technique: "good", createdAt: timestamp });
  raw.nextWorkoutId = Math.max(raw.nextWorkoutId, id + 1);
}
test("per-exercise history endpoint preserves every old set/category and matches the former all-time statistics data exactly", async () => {
  await request("/api/exercises"); const raw = JSON.parse(storage.get(PROGRESS_KEY));
  record(raw, 1, "2026-06-01", 1, "other", 5); record(raw, 2, "2026-10-22"); record(raw, 3, "2026-10-23", 8);
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  const before = new Map(storage), all = await request("/api/stats/insights?days=all");
  const one = await request("/api/exercises/1/insights");
  assert.deepEqual(one, all.exercises.find(e => e.exercise.id === 1));
  assert.equal(one.history.length, 2); assert.equal(one.history.reduce((sum, s) => sum + s.sets.length, 0), 8);
  const outlook = await request("/api/exercises/1/outlook"), timeline = buildExerciseTimeline(outlook, one);
  assert.equal(timeline.points[0].date, "2026-06-01T10:00:00Z"); assert.equal(timeline.forecastStartIndex, 2);
  assert.ok(timeline.points.some(p => p.kind === "forecast")); assert.deepEqual(storage, before);
});
test("unknown exercise errors are distinct from an empty existing exercise journal", async () => {
  assert.equal(await request("/api/exercises/1/insights"), null);
  await assert.rejects(request("/api/exercises/9999/insights"), { status: 404 });
});
test("lightweight body-weight endpoint matches the previous forecast, preserves observations and updates with weighing", async () => {
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 80 });
  await request("/api/body-weight", "PUT", { date: "2026-10-23", kg: 80.2 });
  const before = new Map(storage), body = await request("/api/stats/body-weight");
  assert.deepEqual(body, (await request("/api/stats/outlook")).body); assert.deepEqual(storage, before);
  await request("/api/body-weight", "PUT", { date: "2026-10-24", kg: 80.3 });
  const fresh = await request("/api/stats/body-weight");
  assert.equal(fresh.currentKg, 80.3); assert.equal(fresh.history.length, 3);
});
