import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { storage, request } from "./testHarness.mjs";
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { buildCoachContext } = await import("../lib/aiCoachContext.ts");
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
beforeEach(() => { storage.clear(); globalThis.__failMultiSetOnce = false; });
const create = equipment => request("/api/exercises", "POST", { name: "Category fixture", muscleGroup: "Спина", equipment });
const edit = (id, equipment) => request(`/api/exercises/${id}`, "PATCH", { equipment });
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
async function record(exerciseId, weightKg, reps = 10) {
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, weightKg, reps, rir: 2, technique: "good" });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  return request(`/api/workouts/${workout.id}`);
}

test("all category transitions preserve old sets, body mass, volume and import; only new-category sets affect current ranks", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  for (const original of ["barbell", "dumbbell", "bodyweight", "machine", "other"]) {
    const exercise = await create(original);
    const before = await record(exercise.id, original === "bodyweight" ? 0 : 25);
    for (const next of ["other", "machine", "barbell", "bodyweight", "dumbbell"]) {
      const updated = await edit(exercise.id, next);
      assert.equal(updated.equipment, next);
      assert.equal(updated.rankBest, original === next ? original === "bodyweight" ? 10 : 25 : 0);
      assert.deepEqual(await request(`/api/workouts/${before.id}`), before);
      await restoreProgress(await exportProgress());
      assert.deepEqual(await request(`/api/workouts/${before.id}`), before);
    }
  }
});

test("legacy sets are snapshotted before the first category edit and old weights do not become official barbell records", async () => {
  const before = await record(1, 100);
  const legacy = state(); delete legacy.sets[0].equipment;
  storage.set(PROGRESS_KEY, JSON.stringify(legacy));
  await edit(1, "machine");
  assert.equal(state().sets[0].equipment, "barbell");
  assert.equal((await request(`/api/workouts/${before.id}`)).totalVolume, before.totalVolume);
  assert.equal((await request("/api/levels")).stats.mainExercises.find(ex => ex.exerciseId === 1).bestValue, 0);
  const machine = await record(1, 150);
  await edit(1, "barbell");
  assert.equal((await request("/api/exercises/1/norms")).userMaxWeightKg, 100);
  assert.equal((await request(`/api/workouts/${machine.id}`)).sets[0].equipment, "machine");
  const context = buildCoachContext(state(), "next_workout");
  assert.deepEqual(context.sessions.flatMap(w => w.sets).map(set => set.weightKg), [100]);
  assert.equal(context.truncated, true);
  const insights = await request("/api/stats/insights?days=all");
  const item = insights.exercises.find(item => item.exercise.id === 1);
  assert.equal(item.otherCategorySets, 1);
  assert.deepEqual(item.series.find(series => series.id === "weight").points.map(point => point.value), [100]);
});

test("category edits recalibrate saved types and active targets, and invalidate stale drafts atomically", async () => {
  const exercise = await create("dumbbell");
  const program = await request("/api/programs", "POST", { name: "Fixture", exercises: [{ exerciseId: exercise.id, sets: 2, repsMin: 10, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg: 5, reps: 10 }, { weightKg: 7.5, reps: 10 }] }] });
  const workout = await request("/api/workouts", "POST", { programId: program.id });
  const draft = await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: exercise.id, weightKg: 5, reps: 10, rir: 2, technique: "good" } });
  await edit(exercise.id, "barbell");
  await assert.rejects(request(`/api/workouts/${workout.id}/draft/commit`, "POST", { revision: draft.revision }), { status: 409 });
  const changed = await request(`/api/workouts/${workout.id}/draft`);
  assert.equal(changed.draft.weightKg, 20);
  assert.equal(changed.draft.rir, null);
  assert.deepEqual((await loadPlan(workout.id)).exercises[0].setTargets.map(set => set.weightKg), [20, 20]);
  assert.equal((await request(`/api/programs/${program.id}`)).exercises[0].calibration, true);
  await parseProgressBackup(await exportProgress());
  const before = new Map(storage);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(edit(exercise.id, "bodyweight"));
  assert.deepEqual(storage, before);
  await parseProgressBackup(await exportProgress());
});

test("counterweight and two-dumbbell history remain valid after switching to other equipment", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  for (const settings of [{ equipment: "machine", loadMode: "assisted" }, { equipment: "dumbbell", dumbbellCount: 2 }]) {
    const exercise = await request("/api/exercises", "POST", { name: "Snapshots", muscleGroup: "Спина", ...settings });
    const before = await record(exercise.id, 20);
    await edit(exercise.id, "barbell");
    assert.deepEqual(await request(`/api/workouts/${before.id}`), before);
    assert.equal((await request("/api/exercises")).find(ex => ex.id === exercise.id).loadMode, "weight");
    await restoreProgress(await exportProgress());
    assert.deepEqual(await request(`/api/workouts/${before.id}`), before);
  }
});

test("v9 without category snapshots still imports; malformed snapshots cannot", async () => {
  await record(1, 20);
  const copy = JSON.parse(await exportProgress());
  const serialize = () => { copy.checksum = createHash("sha256").update(JSON.stringify({ state: copy.state, plans: copy.plans })).digest("hex"); return JSON.stringify(copy); };
  copy.version = 9; delete copy.state.sets[0].equipment;
  await restoreProgress(serialize());
  assert.equal((await request("/api/workouts/1")).totalVolume, 200);
  copy.version = 10; copy.state.sets[0].equipment = "invalid";
  await assert.rejects(parseProgressBackup(serialize()));
});

test("monthly targets are recalibrated and outstanding coach proposals become stale after a category edit", async () => {
  const exercise = await create("dumbbell");
  const context = await request("/api/ai-coach/context", "POST", { task: "month_plan" });
  const monthly = { name: "Fixture month", overview: "Fixture progression", daysPerWeek: 3,
    templates: [{ name: "Fixture", description: "Calibration", exercises: [{ exerciseId: exercise.id, reason: "Fixture", targets: [{ weightKg: 2.5, reps: 8, durationSeconds: null }] }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Fixture", sessions: [0, 0, 0] })) };
  const body = { context, fingerprint: await coachFingerprint(context), monthly };
  await request("/api/ai-coach/month", "PUT", body);
  await edit(exercise.id, "barbell");
  assert.equal(state().coachMonth.plan.templates[0].exercises[0].targets[0].weightKg, 20);
  await assert.rejects(request("/api/ai-coach/month", "PUT", body), { status: 409 });
  await restoreProgress(await exportProgress());
  assert.equal((await request("/api/ai-coach/context", "POST", { task: "next_workout" })).scheduled.plan.exercises[0].targets[0].weightKg, 20);
});
