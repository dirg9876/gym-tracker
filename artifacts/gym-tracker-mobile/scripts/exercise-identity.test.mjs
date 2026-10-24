import assert from "node:assert/strict";
import { beforeEach, afterEach, mock, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { buildNextExercisePrediction } = await import("../lib/trainingPrediction.ts");
const { buildExerciseOutlook } = await import("../lib/exerciseOutlook.ts");
const { buildExerciseTimeline } = await import("../lib/exerciseTimeline.ts");
const { buildCoachContext } = await import("../lib/aiCoachContext.ts");
const now = new Date("2026-10-24T10:00:00Z");
beforeEach(async () => {
  storage.clear(); globalThis.__failMultiSetOnce = false;
  mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  await request("/api/exercises");
});
afterEach(() => mock.timers.reset());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const persist = raw => storage.set(PROGRESS_KEY, JSON.stringify(raw));
function session(raw, exerciseId, day, results, extra = {}) {
  const id = raw.nextWorkoutId++, date = `2026-10-${day}T10:00:00Z`;
  raw.workouts.push({ id, name: null, startedAt: date, finishedAt: date });
  for (const [weightKg, reps] of results) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId,
    weightKg, reps, createdAt: date, rir: null, technique: null, ...extra });
  return id;
}
function duplicate(raw, equipment = "other") {
  const target = raw.exercises.find(ex => ex.id === 1);
  const source = { ...target, id: raw.nextExerciseId++, isCustom: true, isMain: false, equipment,
    name: `  ${target.name.toUpperCase()}  ` };
  raw.exercises.push(source);
  return source;
}

test("five other-category press sets remain in the chart, prediction, analysis and AI context without rewriting history", async () => {
  const exercise = await request("/api/exercises", "POST", { name: "Жим штанги в наклоне", muscleGroup: "Грудь", equipment: "barbell" });
  const raw = state();
  session(raw, exercise.id, "13", [[20, 12], [50, 10], [50, 10], [50, 10]]);
  const latest = session(raw, exercise.id, "20", [[50, 10], [50, 6], [40, 10], [40, 10], [40, 10]], { equipment: "other", loadMode: "weight" });
  session(raw, 1, "20", [[85, 1]], { equipment: "barbell" });
  persist(raw); const before = new Map(storage);
  const insight = (await request("/api/stats/insights?days=all")).exercises.find(row => row.exercise.id === exercise.id);
  assert.equal(insight.otherCategorySets, 0); assert.equal(insight.sets, 9);
  assert.equal(insight.history.find(row => row.workoutId === latest).sets.length, 5);
  const outlook = buildExerciseOutlook(raw, exercise.id, now), chart = buildExerciseTimeline(outlook, insight);
  assert.equal(chart.forecastStartIndex, 2);
  assert.deepEqual(chart.points.slice(0, 2).map(point => point.value), [50, 50]);
  const prediction = buildNextExercisePrediction(raw, exercise.id, now.getTime());
  assert.equal(prediction.next.weightKg, 40); assert.equal(prediction.next.action, "hold");
  const context = buildCoachContext(raw, "next_workout");
  assert.equal(context.sessions.flatMap(row => row.sets).filter(row => row.exerciseId === exercise.id).length, 9);
  const analysis = context.analysis.exercises.filter(row => row.exerciseId === exercise.id);
  assert.equal(analysis.length, 1); assert.equal(analysis[0].sets, 5);
  assert.equal(analysis[0].matchesCurrentCategory, true);
  assert.equal(analysis[0].next.weightKg, 40);
  assert.deepEqual(storage, before);
  await restoreProgress(await exportProgress());
  assert.deepEqual(state().sets, raw.sets);
});

test("creating the same normalized name reuses its identity regardless category and still validates the form", async () => {
  const original = (await request("/api/exercises")).find(ex => ex.id === 1);
  const before = new Map(storage);
  const reused = await request("/api/exercises", "POST", { name: ` ${original.name.toUpperCase().replace(/ё/g, "е")} `, muscleGroup: "Грудь", equipment: "other" });
  assert.equal(reused.id, original.id); assert.equal(reused.equipment, "barbell");
  assert.deepEqual(storage, before);
  await assert.rejects(request("/api/exercises", "POST", { name: original.name, muscleGroup: "Грудь", equipment: "invalid" }), { status: 400 });
  const other = await request("/api/exercises", "POST", { name: `${original.name} в наклоне`, muscleGroup: "Грудь", equipment: "barbell" });
  assert.notEqual(other.id, original.id);
});

test("old same-name catalog entries merge atomically with all set IDs, dates, volume and saved references intact", async () => {
  const raw = state(), source = duplicate(raw);
  const id = session(raw, source.id, "20", [[50, 10], [40, 10]]);
  raw.customPrograms.push({ id: raw.nextProgramId++, name: "Duplicate references", description: "Fixture", exercises: [
    { exerciseId: 1, sets: 1, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 60, reps: 10 }] },
    { exerciseId: source.id, sets: 1, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 50, reps: 10 }] },
  ] });
  persist(raw); const oldSets = raw.sets.map(row => ({ ...row }));
  const catalog = await request("/api/exercises");
  assert.ok(!catalog.some(row => row.id === source.id));
  assert.equal(state().sets.length, 2);
  assert.deepEqual(state().sets.map(({ exerciseId, equipment, loadMode, ...row }) => row), oldSets.map(({ exerciseId, ...row }) => row));
  assert.ok(state().sets.every(row => row.exerciseId === 1 && row.equipment === "other"));
  assert.equal((await request(`/api/workouts/${id}`)).totalVolume, 900);
  const plan = state().customPrograms[0];
  assert.equal(plan.exercises.length, 1); assert.equal(plan.exercises[0].sets, 2);
  assert.deepEqual(plan.exercises[0].setTargets.map(row => row.weightKg), [60, 50]);
  const before = new Map(storage); await request("/api/exercises"); assert.deepEqual(storage, before);
  await restoreProgress(await exportProgress());
  assert.equal((await request("/api/stats/insights?days=all")).exercises.find(row => row.exercise.id === 1).sets, 2);
});

test("a storage fault during duplicate migration rolls back history and does not quarantine valid progress", async () => {
  const raw = state(), source = duplicate(raw); session(raw, source.id, "20", [[50, 10]]); persist(raw);
  const before = new Map(storage); globalThis.__failMultiSetOnce = true;
  await assert.rejects(request("/api/exercises")); assert.deepEqual(storage, before);
  await request("/api/exercises"); assert.equal(state().sets[0].exerciseId, 1);
  await parseProgressBackup(await exportProgress());
});

test("an active workout keeps IDs stable; duplicate migration resumes after it is finished", async () => {
  const raw = state(), source = duplicate(raw);
  const id = session(raw, source.id, "20", [[50, 10]]); raw.workouts[0].finishedAt = null; persist(raw);
  const before = new Map(storage); await request("/api/exercises"); assert.deepEqual(storage, before);
  await request(`/api/workouts/${id}/finish`, "POST");
  await request("/api/exercises"); assert.equal(state().sets[0].exerciseId, 1);
});

test("incompatible future targets require review instead of corrupting a saved program or losing history", async () => {
  const raw = state(), source = duplicate(raw); session(raw, source.id, "20", [[50, 10]]);
  raw.customPrograms.push({ id: raw.nextProgramId++, name: "Review low target", description: "Fixture", exercises: [
    { exerciseId: source.id, sets: 1, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 5, reps: 10 }] },
  ] });
  persist(raw); await request("/api/exercises");
  assert.equal(state().exercises.find(row => row.id === source.id).replacementPending, true);
  assert.deepEqual(state().sets, raw.sets);
  assert.deepEqual(state().customPrograms, raw.customPrograms);
  await parseProgressBackup(await exportProgress());
});

test("a counterweight name conflict is visible for review and cannot silently become an ordinary load", async () => {
  const raw = state(), source = duplicate(raw, "machine"); source.loadMode = "assisted";
  session(raw, source.id, "20", [[20, 10]], { equipment: "machine", loadMode: "assisted", bodyWeightKg: 80 });
  persist(raw); await request("/api/exercises");
  const maintenance = await request("/api/exercises/maintenance");
  assert.equal(maintenance.find(row => row.exercise.id === source.id).exercise.replacementPending, true);
  assert.equal(state().sets[0].exerciseId, source.id); assert.equal(state().sets[0].loadMode, "assisted");
  await parseProgressBackup(await exportProgress());
});
