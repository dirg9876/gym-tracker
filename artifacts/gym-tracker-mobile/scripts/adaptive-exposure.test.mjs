import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";
const { buildAdaptiveSplit } = await import("../lib/adaptiveWorkout.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const now = Date.parse("2026-10-24T10:00:00Z");
beforeEach(async () => { storage.clear(); await request("/api/exercises"); });
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const profile = () => ({ ...defaultCoachProfile(), goal: "hypertrophy", sessionMinutes: 60 });
function record(raw, exerciseId, day, reps = 10, extra = {}) {
  const id = raw.nextWorkoutId++, date = `2026-10-${day}T10:00:00Z`;
  raw.workouts.push({ id, name: null, startedAt: date, finishedAt: date });
  for (let n = 0; n < 3; n++) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId, weightKg: 50, reps, rir: 2, technique: "good", createdAt: date, ...extra });
}
test("3/4-rep strength work and breakdown exposure are not erased from the split workload proxy", () => {
  for (const reps of [3, 4, 5]) for (const technique of ["good", "breakdown"]) {
    const raw = state(); record(raw, 1, 22, reps, { technique }); record(raw, 7, 23);
    const before = structuredClone(raw);
    const split = buildAdaptiveSplit(raw, { ...profile(), goal: "strength" }, raw.exercises, now);
    assert.equal(split.day, "legs", `${reps} reps / ${technique}`); assert.deepEqual(raw, before);
  }
});
test("performed assisted work still contributes exposure even though it cannot supply successful load-model evidence", () => {
  const raw = state(); raw.exercises.find(e => e.id === 1).loadMode = "assisted";
  record(raw, 1, 22, 10, { loadMode: "assisted" }); record(raw, 7, 23);
  assert.equal(buildAdaptiveSplit(raw, profile(), raw.exercises, now).day, "legs");
});
test("a 60-minute restricted-equipment leg day reaches available core slots instead of returning an empty plan", () => {
  const raw = state(), available = raw.exercises.filter(e => e.equipment === "bodyweight");
  const split = buildAdaptiveSplit(raw, profile(), available, now, "legs");
  assert.ok(split.definitions.length > 0 && split.definitions.length <= 4);
  assert.ok(split.definitions.every(d => available.some(e => e.id === d.exerciseId)));
});
test("short leg days alternate direct core and calves instead of permanently omitting core", () => {
  const raw = state(), first = buildAdaptiveSplit(raw, profile(), raw.exercises, now, "legs");
  const groups = split => split.definitions.map(d => raw.exercises.find(e => e.id === d.exerciseId).muscleGroup);
  assert.ok(groups(first).includes("Пресс"));
  for (const item of first.definitions) record(raw, item.exerciseId, 23);
  const second = buildAdaptiveSplit(raw, profile(), raw.exercises, now, "legs");
  assert.ok(groups(second).includes("Икры")); assert.ok(second.definitions.length <= 4);
});
test("conventional deadlift exposes legs as well as its catalog pull day without pretending to measure recovery", () => {
  const raw = state(); record(raw, 6, 23, 5); record(raw, 7, 24);
  assert.equal(buildAdaptiveSplit(raw, profile(), raw.exercises, now + 1000).day, "push");
});
