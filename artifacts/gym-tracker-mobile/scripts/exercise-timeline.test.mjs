import assert from "node:assert/strict";
import { beforeEach, afterEach, mock, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { buildExerciseOutlook } = await import("../lib/exerciseOutlook.ts");
const { buildExerciseTimeline } = await import("../lib/exerciseTimeline.ts");
const { lineChartGeometry } = await import("../lib/chartGeometry.ts");
const now = new Date("2026-10-23T17:51:00Z");
beforeEach(async () => {
  storage.clear(); mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy", daysPerWeek: 3 });
});
afterEach(() => mock.timers.reset());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const persist = raw => storage.set(PROGRESS_KEY, JSON.stringify(raw));
function record(raw, exerciseId, date, kg, reps = 10, count = 3, extra = {}) {
  const id = raw.nextWorkoutId++, timestamp = `${date}T10:00:00Z`;
  raw.workouts.push({ id, name: null, startedAt: timestamp, finishedAt: timestamp });
  const exercise = raw.exercises.find(ex => ex.id === exerciseId);
  for (let i = 0; i < count; i++) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId, weightKg: kg, reps,
    equipment: exercise.equipment, rir: 2, technique: "good", createdAt: timestamp, ...extra });
  return id;
}
async function insights(raw, exerciseId) {
  persist(raw);
  return (await request("/api/stats/insights?days=all")).exercises.find(row => row.exercise.id === exerciseId);
}

test("a single chronological chart retains the entire measured history, including records older than 24 sessions", async () => {
  const raw = state();
  for (let day = 1; day <= 30; day++) record(raw, 1, `2026-09-${String(day).padStart(2, "0")}`, 50);
  record(raw, 1, "2026-10-22", 60);
  const history = await insights(raw, 1), outlook = buildExerciseOutlook(raw, 1, now), before = structuredClone({ history, outlook });
  const chart = buildExerciseTimeline(outlook, history);
  assert.equal(chart.points[0].date, "2026-09-01T10:00:00Z");
  assert.equal(chart.forecastStartIndex, 31);
  assert.equal(chart.points.length, 31 + outlook.sessions.length);
  assert.ok(chart.points.slice(0, 31).every(row => row.kind === "history"));
  assert.ok(chart.points.slice(31).every(row => row.kind === "forecast"));
  assert.ok(chart.points.every((row, i) => !i || Date.parse(row.date) >= Date.parse(chart.points[i - 1].date)));
  assert.deepEqual({ history, outlook }, before);
});

test("the observed heavy single and three older 50 kg sets are not replaced by 60 kg future prescriptions", async () => {
  const raw = state(), older = record(raw, 1, "2026-09-01", 50);
  record(raw, 1, "2026-10-22", 85, 1, 1, { rir: null, technique: null });
  const history = await insights(raw, 1), outlook = buildExerciseOutlook(raw, 1, now);
  const chart = buildExerciseTimeline(outlook, history);
  assert.equal(chart.points[0].workoutId, older); assert.equal(chart.points[0].value, 50);
  assert.equal(chart.points[1].value, 85); assert.equal(chart.points[1].set.reps, 1);
  assert.equal(history.history.find(w => w.workoutId === older).sets.length, 3);
  assert.ok(chart.points.slice(chart.forecastStartIndex).every(row => row.kind === "forecast"));
});

test("60 kg is a double-progression scenario, not a frozen prescription: reps rise, then a conditional 62.5 kg step", async () => {
  const raw = state(); record(raw, 1, "2026-10-22", 60, 10, 1, { rir: null, technique: null });
  const id = raw.workouts.at(-1).id;
  for (const [kg, reps] of [[70, 5], [80, 3], [85, 1]]) raw.sets.push({ ...raw.sets.at(-1), id: raw.nextSetId++, workoutId: id, weightKg: kg, reps });
  const before = structuredClone(raw), outlook = buildExerciseOutlook(raw, 1, now);
  assert.deepEqual(outlook.sessions.map(row => [row.targets[0].weightKg, row.targets[0].reps]), [[60, 10], [60, 11], [60, 12], [60, 12], [62.5, 8], [62.5, 9]]);
  assert.deepEqual(outlook.progression, { nextWeightKg: 62.5, earliestDate: outlook.sessions[4].date, reps: 12, sets: 3, confirmations: 2, targetRir: 2 });
  assert.deepEqual(raw, before, "conditional successes must never become real measurements");
});

test("history and forecast can share a repetitions axis without mixing kilograms with repetitions", async () => {
  const raw = state(); record(raw, 1, "2026-10-22", 60);
  const history = await insights(raw, 1), outlook = buildExerciseOutlook(raw, 1, now);
  const chart = buildExerciseTimeline(outlook, history, "reps");
  assert.equal(chart.metric.unit, "reps"); assert.equal(chart.points[0].value, 10);
  assert.equal(chart.points.at(-1).value, outlook.sessions.at(-1).targets[0].reps);
});

test("an exercise without measurements shows calibration, not fictional observations or forecast strength", () => {
  const raw = state(), outlook = buildExerciseOutlook(raw, 1, now), chart = buildExerciseTimeline(outlook);
  assert.equal(outlook.calibration, true); assert.equal(outlook.progression, null);
  assert.deepEqual(chart.points, []); assert.equal(chart.forecastStartIndex, -1);
  assert.equal(chart.metric.id, "weight");
});

test("seconds stay seconds, and zero added bodyweight load stays a repetition curve", async () => {
  const raw = state(); record(raw, 30, "2026-10-20", 0, 0, 3, { durationSeconds: 45, rir: null });
  record(raw, 7, "2026-10-22", 0, 10);
  for (const [id, unit, value] of [[30, "seconds", 45], [7, "reps", 10]]) {
    const history = await insights(raw, id), outlook = buildExerciseOutlook(raw, id, now);
    const chart = buildExerciseTimeline(outlook, history);
    assert.equal(chart.metric.unit, unit); assert.equal(chart.points[0].value, value);
    assert.equal(outlook.progression, null);
    assert.ok(chart.points.every(row => Number.isFinite(row.value)));
  }
});

test("assisted movements preserve counterweight semantics and never invent an automatic load increase", async () => {
  const ex = await request("/api/exercises", "POST", { name: "Assisted test", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  const raw = state(); raw.profile.bodyWeightKg = 80;
  record(raw, ex.id, "2026-10-22", 20, 10, 3, { loadMode: "assisted", bodyWeightKg: 80 });
  const history = await insights(raw, ex.id), outlook = buildExerciseOutlook(raw, ex.id, now), chart = buildExerciseTimeline(outlook, history);
  assert.equal(chart.metric.id, "assistance"); assert.equal(outlook.progression, null);
  assert.ok(chart.points.every(row => row.value === 20));
});

test("old category labels for the same exercise remain in both the journal and comparison curve", async () => {
  const raw = state(); record(raw, 1, "2026-09-01", 50, 10, 3, { equipment: "other" }); record(raw, 1, "2026-10-22", 60);
  const history = await insights(raw, 1), chart = buildExerciseTimeline(buildExerciseOutlook(raw, 1, now), history);
  assert.equal(history.history.length, 2); assert.equal(chart.forecastStartIndex, 2);
  assert.deepEqual(chart.points.slice(0, 2).map(row => row.value), [50, 60]);
});

test("future and unfinished records cannot turn projections into observed history", async () => {
  const raw = state(); record(raw, 1, "2026-10-20", 60); record(raw, 1, "2026-11-01", 100);
  record(raw, 1, "2026-10-22", 90); raw.workouts.at(-1).finishedAt = null;
  const history = await insights(raw, 1), chart = buildExerciseTimeline(buildExerciseOutlook(raw, 1, now), history);
  assert.equal(chart.forecastStartIndex, 1); assert.equal(chart.points[0].value, 60);
});

test("an equipment step exceeding ten percent is held for manual confirmation, not sold as an automatic milestone", () => {
  const raw = state(); raw.exercises.find(ex => ex.id === 1).weightStepKg = 10;
  record(raw, 1, "2026-10-22", 60, 12);
  const outlook = buildExerciseOutlook(raw, 1, now);
  assert.equal(outlook.progression, null); assert.ok(outlook.sessions.every(row => row.targets[0].weightKg === 60));
});

test("a flat 60 kg plot uses a useful equipment-scale range rather than a misleading 59.9 to 60.1 zoom", () => {
  const points = [{ date: "2026-10-29", value: 60 }, { date: "2026-11-19", value: 60 }];
  const geometry = lineChartGeometry(points, 320, 180, false, 5);
  assert.equal(geometry.ticks[0].value, 57.5); assert.equal(geometry.ticks.at(-1).value, 62.5);
  assert.ok(geometry.coordinates.every(row => Number.isFinite(row.x) && Number.isFinite(row.y)));
});
