import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { storage, request } from "./testHarness.mjs";
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
beforeEach(() => {
  storage.clear();
  globalThis.__failMultiSetOnce = false;
  globalThis.__failMultiRemoveOnce = false;
});
const def = (exerciseId = 1) => ({ exerciseId, sets: 1, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 20, reps: 10 }] });
const startPlan = async () => {
  const program = await request("/api/programs", "POST", { name: "Delete QA", exercises: [def(), def(3)] });
  return request("/api/workouts", "POST", { programId: program.id });
};
test("catalog replacement includes built-ins and preserves recorded sets and statistics", async () => {
  const workout = await startPlan();
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 100, reps: 1, setType: "working" });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 6, weightKg: 180, reps: 1, setType: "working" });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 12, weightKg: 140, reps: 1, setType: "working" });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const original = await request(`/api/workouts/${workout.id}`);
  const overview = await request("/api/stats/overview");
  const levels = await request("/api/levels");
  assert.ok(levels.currentLevel > 0);
  await assert.rejects(request("/api/exercises/1", "DELETE"), { status: 409 });
  await request("/api/exercises/1/replace", "POST", { targetExerciseId: 2 });
  await request("/api/exercises/1", "DELETE");
  assert.equal((await request("/api/exercises")).some(ex => ex.id === 1), false);
  const transferred = await request(`/api/workouts/${workout.id}`);
  assert.equal(transferred.totalVolume, original.totalVolume);
  assert.equal(transferred.sets.length, original.sets.length);
  assert.equal(transferred.sets[0].exerciseId, 2);
  assert.equal((await request("/api/stats/overview")).totalVolume, overview.totalVolume);
  assert.ok((await request("/api/levels")).currentLevel >= levels.currentLevel);
  assert.deepEqual((await request("/api/programs/1")).exercises.map(ex => ex.exerciseId), [2, 3]);
  assert.equal(await loadPlan(workout.id), null);
  assert.equal((await request("/api/programs/chest")).exercises.some(ex => ex.exerciseId === 1), false);
  const text = await exportProgress();
  assert.equal(JSON.parse(text).version, 9);
  await restoreProgress(text);
  assert.equal((await request("/api/exercises")).some(ex => ex.id === 1), false);
  assert.deepEqual(await request(`/api/workouts/${workout.id}`), transferred);
  assert.equal((await request("/api/stats/exercises/2/progress")).points.length, 1);
});
test("deleted exercises cannot be recorded or reintroduced by a stale template editor", async () => {
  const workout = await startPlan();
  await request("/api/exercises/1", "DELETE");
  await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 }), { status: 404 });
  await assert.rejects(request("/api/exercises/1", "PATCH", { isMain: false }), { status: 404 });
  await assert.rejects(request("/api/programs", "POST", { name: "Stale", exercises: [def()] }), { status: 400 });
  await assert.rejects(request("/api/programs/1", "PUT", { name: "Stale", exercises: [def()] }), { status: 400 });
  await parseProgressBackup(await exportProgress());
});
test("deleting the only exercise leaves an editable empty type and an intact backup", async () => {
  const program = await request("/api/programs", "POST", { name: "Empty later", exercises: [def()] });
  const workout = await request("/api/workouts", "POST", { programId: program.id });
  await request("/api/exercises/1", "DELETE");
  assert.deepEqual((await request(`/api/programs/${program.id}`)).exercises, []);
  assert.deepEqual((await loadPlan(workout.id)).exercises, []);
  await restoreProgress(await exportProgress());
  assert.equal((await request("/api/programs")).programs[0].exerciseCount, 0);
});
test("active and completed workouts can be deleted with sets, timer and plan; types survive", async () => {
  for (const finished of [false, true]) {
    const workout = await startPlan();
    await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10, setType: "working" });
    await request(`/api/workouts/${workout.id}/timer`, "PUT", { kind: "rest", totalMs: 120000, remainingMs: 120000, endsAt: Date.now() + 120000 });
    if (finished) await request(`/api/workouts/${workout.id}/finish`, "POST");
    await request(`/api/workouts/${workout.id}`, "DELETE");
    assert.equal((await request("/api/workouts")).length, 0);
    assert.equal((await request("/api/workouts/active")).workout, null);
    assert.equal(await loadPlan(workout.id), null);
    assert.equal((await request("/api/stats/overview")).totalWorkouts, 0);
    assert.deepEqual((await request("/api/stats/weekly")).groups, []);
    await assert.rejects(request(`/api/workouts/${workout.id}/timer`), { status: 404 });
    await assert.rejects(request(`/api/workouts/${workout.id}`), { status: 404 });
    const backup = await parseProgressBackup(await exportProgress());
    assert.equal(backup.state.sets.length, 0);
    assert.ok(backup.state.customPrograms.length > 0);
  }
});
test("interrupted catalog and workout deletions roll back the state and plans together", async () => {
  const workout = await startPlan();
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  for (const [url, flag] of [["/api/exercises/2", "__failMultiSetOnce"], [`/api/workouts/${workout.id}`, "__failMultiSetOnce"], [`/api/workouts/${workout.id}`, "__failMultiRemoveOnce"]]) {
    const original = new Map(storage);
    globalThis[flag] = true;
    await assert.rejects(request(url, "DELETE"));
    assert.deepEqual(storage, original);
    await parseProgressBackup(await exportProgress());
  }
});
test("backup validates deletion dates and rejects archived exercise references in future plans", async () => {
  await startPlan();
  const original = JSON.parse(await exportProgress());
  const before = new Map(storage);
  for (const deletedAt of [true, "invalid", "2026-10-13T00:00:00.000Z"]) {
    const backup = structuredClone(original);
    backup.state.exercises[0].deletedAt = deletedAt;
    backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex");
    await assert.rejects(restoreProgress(JSON.stringify(backup)));
    assert.deepEqual(storage, before);
  }
  for (const version of [1, 2, 3, 4]) {
    const legacy = { ...original, version };
    await parseProgressBackup(JSON.stringify(legacy));
  }
});
