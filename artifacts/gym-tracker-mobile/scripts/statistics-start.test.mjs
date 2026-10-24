import assert from "node:assert/strict";
import { beforeEach, afterEach, test, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { buildProgressOutlook } = await import("../lib/exerciseOutlook.ts");
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const now = new Date("2026-10-23T12:00:00Z");
beforeEach(async () => { storage.clear(); mock.timers.enable({ apis: ["Date"], now: now.getTime() }); await request("/api/exercises"); });
afterEach(() => mock.timers.reset());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const persist = raw => storage.set(PROGRESS_KEY, JSON.stringify(raw));
function record(raw, exerciseId, date, kg, reps = 10, count = 3, extra = {}) {
  const id = raw.nextWorkoutId++, timestamp = `${date}T10:00:00Z`;
  raw.workouts.push({ id, name: null, startedAt: timestamp, finishedAt: timestamp });
  for (let i = 0; i < count; i++) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId, weightKg: kg, reps, rir: 2, technique: "good", createdAt: timestamp, ...extra });
  return id;
}

test("the complete exercise history retains all three 50 kg sets alongside a later heavy single", async () => {
  const raw = state(), older = record(raw, 1, "2026-09-01", 50);
  record(raw, 1, "2026-10-20", 85, 1, 1); persist(raw);
  const all = await request("/api/stats/insights?days=all");
  const bench = all.exercises.find(ex => ex.exercise.id === 1);
  assert.equal(bench.history.length, 2);
  assert.deepEqual(bench.history.find(w => w.workoutId === older).sets.map(set => [set.weightKg, set.reps]), [[50, 10], [50, 10], [50, 10]]);
  assert.equal((await request("/api/stats/insights?days=28")).exercises[0].history.length, 1);
  assert.equal(bench.series.find(s => s.id === "weight").points.length, 2);
});
test("category changes preserve every historical set in the current exercise chart", async () => {
  const raw = state(); record(raw, 1, "2026-10-10", 50, 10, 3, { equipment: "other" });
  record(raw, 1, "2026-10-20", 60, 10, 3, { equipment: "barbell" }); persist(raw);
  const bench = (await request("/api/stats/insights?days=all")).exercises[0];
  assert.equal(bench.history.flatMap(w => w.sets).length, 6);
  assert.equal(bench.otherCategorySets, 0); assert.equal(bench.series[0].points.length, 2);
});
test("all-time history exposes every session beyond the chart display window and is read-only", async () => {
  const raw = state();
  for (let day = 1; day <= 30; day++) record(raw, 1, `2026-09-${String(day).padStart(2, "0")}`, 50);
  persist(raw); const saved = new Map(storage);
  assert.equal((await request("/api/stats/insights?days=all")).exercises[0].history.length, 30);
  assert.deepEqual(storage, saved);
});
test("a first backdated weigh-in becomes the current profile without altering historical snapshots", async () => {
  const raw = state(); raw.profile.bodyWeightKg = 92;
  record(raw, 7, "2026-10-10", 0, 8, 3, { equipment: "bodyweight", bodyWeightKg: 92 }); persist(raw);
  const sets = state().sets;
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 93 });
  assert.equal((await request("/api/profile")).bodyWeightKg, 93);
  assert.equal((await request("/api/stats/outlook")).body.currentKg, 93);
  assert.equal((await request("/api/levels")).bodyWeightKg, 93);
  assert.deepEqual(state().sets, sets);
});
test("older measurements and corrections cannot replace the newest dated profile weight", async () => {
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 93 });
  await request("/api/body-weight", "PUT", { date: "2026-10-10", kg: 90 });
  assert.equal((await request("/api/profile")).bodyWeightKg, 93);
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 93.5 });
  assert.equal((await request("/api/profile")).bodyWeightKg, 93.5);
  await request("/api/body-weight/2026-10-22", "DELETE");
  assert.equal((await request("/api/profile")).bodyWeightKg, 90);
});
test("legacy last pull workout is excluded from both selectable splits", async () => {
  const raw = state(); record(raw, 7, "2026-10-22", 0, 8); persist(raw);
  const p = await request("/api/daily-workout");
  assert.deepEqual(p.choices.map(c => c.splitDay).sort(), ["legs", "push"]);
  assert.ok(p.choices.every(c => c.plan.exercises.length > 0));
  await assert.rejects(request("/api/daily-workout?split=pull"), { status: 400 });
});
test("selected alternative has its own fingerprint, persists its split and survives backup", async () => {
  const raw = state(); record(raw, 7, "2026-10-22", 0, 8); persist(raw);
  const first = await request("/api/daily-workout");
  const other = first.choices.find(c => c.splitDay !== first.splitDay).splitDay;
  const choice = await request(`/api/daily-workout?split=${other}`);
  assert.notEqual(choice.fingerprint, first.fingerprint);
  await assert.rejects(request("/api/daily-workout/start", "POST", { fingerprint: first.fingerprint, splitDay: other }), { status: 409 });
  const w = await request("/api/daily-workout/start", "POST", { fingerprint: choice.fingerprint, splitDay: other });
  assert.equal(state().workouts.find(row => row.id === w.id).splitDay, other);
  const copy = await exportProgress(); await restoreProgress(copy);
  assert.equal(state().workouts.find(row => row.id === w.id).splitDay, other);
});
test("AI reviews the selected alternative rather than the default split", async () => {
  const raw = state(); record(raw, 7, "2026-10-22", 0, 8); persist(raw);
  const p = await request("/api/daily-workout?split=push");
  const c = await request("/api/ai-coach/context", "POST", { task: "next_workout", splitDay: "push" });
  assert.equal(c.preparedWorkout.name, p.plan.name);
  assert.deepEqual(c.preparedWorkout.exercises.map(e => e.exerciseId), p.plan.exercises.map(e => e.exerciseId));
});
test("completed selected split is excluded even if its last set was core or there is a later office session", async () => {
  const raw = state(); const id = record(raw, 29, "2026-10-22", 0, 12);
  raw.workouts.find(w => w.id === id).splitDay = "push";
  const office = record(raw, 7, "2026-10-23", 0, 3); raw.workouts.find(w => w.id === office).trainingMode = "office";
  persist(raw);
  assert.deepEqual((await request("/api/daily-workout")).choices.map(c => c.splitDay).sort(), ["legs", "pull"]);
});
test("unavailable equipment never produces invented alternatives; manual start remains possible", async () => {
  const raw = state(); raw.exercises = raw.exercises.filter(ex => ex.id === 7);
  record(raw, 7, "2026-10-22", 0, 8); persist(raw);
  const p = await request("/api/daily-workout");
  assert.deepEqual(p.choices, []); assert.equal(p.plan, null);
  const w = await request("/api/workouts", "POST"); assert.equal(w.totalSets, 0);
});
test("an empty completed selected workout cannot hide an unperformed split", async () => {
  const raw = state(); record(raw, 7, "2026-10-20", 0, 8);
  raw.workouts.push({ id: raw.nextWorkoutId++, name: null, startedAt: "2026-10-22T10:00:00Z", finishedAt: "2026-10-22T10:01:00Z", splitDay: "push" });
  persist(raw);
  assert.deepEqual((await request("/api/daily-workout")).choices.map(c => c.splitDay).sort(), ["legs", "push"]);
});
test("a different split does not consume or overwrite the next monthly slot", async () => {
  const raw = state(); record(raw, 1, "2026-10-22", 50);
  raw.coachMonth = { id: "a".repeat(64), createdAt: now.toISOString(), plan: { name: "Month", overview: "fixture", daysPerWeek: 3,
    templates: [{ name: "Chest", description: "", exercises: [{ exerciseId: 1, reason: "fixture", targets: [{ weightKg: 50, reps: 10, durationSeconds: null }] }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "fixture", sessions: [0, 0, 0] })) } }; persist(raw);
  const month = structuredClone(raw.coachMonth), p = await request("/api/daily-workout");
  assert.ok(p.choices.every(c => c.splitDay !== "push")); assert.equal(p.scheduled, null);
  const w = await request("/api/daily-workout/start", "POST", { fingerprint: p.fingerprint, splitDay: p.splitDay });
  assert.equal(state().workouts.find(row => row.id === w.id).coachCycle, undefined);
  assert.deepEqual(state().coachMonth, month);
});
test("forecast dates use the same adaptive selection after an assumed first session", () => {
  const raw = state(); record(raw, 1, "2026-10-20", 50, 10, 12); record(raw, 7, "2026-10-22", 0, 8, 3); record(raw, 14, "2026-10-18", 50);
  const outlook = buildProgressOutlook(raw, now), first = buildDailyWorkout(raw, now);
  const date = outlook.exercises.find(e => e.exercise.id === first.plan.exercises[0].exerciseId).sessions[0].date;
  const clone = structuredClone(raw);
  for (const ex of first.plan.exercises) record(clone, ex.exerciseId, date, ex.suggestedWeightKg, ex.repsMin, ex.sets + (ex.postCalibrationSets ?? 0));
  const secondDate = new Date(`${date}T12:00:00Z`); secondDate.setDate(secondDate.getDate() + 2);
  const second = buildDailyWorkout(clone, secondDate);
  for (const ex of second.plan.exercises) assert.ok(Math.abs(Date.parse(outlook.exercises.find(row => row.exercise.id === ex.exerciseId).sessions[0].date) - Date.parse(second.date)) <= 86400000);
});
