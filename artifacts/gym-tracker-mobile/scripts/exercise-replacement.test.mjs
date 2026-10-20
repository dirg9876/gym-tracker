import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { storage, request } from "./testHarness.mjs";
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { canReplaceExercise } = await import("../lib/exerciseReplacement.ts");
beforeEach(() => { storage.clear(); globalThis.__failMultiSetOnce = false; });
const create = data => request("/api/exercises", "POST", { name: "Custom press", muscleGroup: "Грудь", equipment: "dumbbell", ...data });
const replace = (id, body) => request(`/api/exercises/${id}/replace`, "POST", body);
const target = (exerciseId, weightKg) => ({ exerciseId, sets: 1, repsMin: 8, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg, reps: 10 }] });
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const rehash = backup => { backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex"); return JSON.stringify(backup); };

test("history requires a replacement, then transfers without tombstones or lost measurements", async () => {
  const source = await create({ dumbbellCount: 2 });
  const destination = await create({ name: "New press", dumbbellCount: 2 });
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: source.id, weightKg: 12.5, reps: 10, rir: 3, technique: "good" });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const before = await request(`/api/workouts/${workout.id}`);
  const saved = new Map(storage);
  await assert.rejects(request(`/api/exercises/${source.id}`, "DELETE"), { status: 409 });
  assert.deepEqual(storage, saved);
  await replace(source.id, { targetExerciseId: destination.id });
  const after = await request(`/api/workouts/${workout.id}`);
  assert.equal(after.totalVolume, before.totalVolume);
  assert.equal(after.sets[0].id, before.sets[0].id);
  assert.equal(after.sets[0].exerciseId, destination.id);
  assert.equal(after.sets[0].weightKg, 12.5);
  assert.equal(after.sets[0].reps, 10);
  assert.equal(after.sets[0].rir, 3);
  assert.equal(after.sets[0].technique, "good");
  assert.ok(!state().exercises.some(ex => ex.id === source.id || ex.deletedAt));
  assert.equal((await request("/api/exercises")).find(ex => ex.id === destination.id).rankBest, 12.5);
  await restoreProgress(await exportProgress());
  assert.deepEqual(await request(`/api/workouts/${workout.id}`), after);
});

test("compatible aliases merge targets in saved types and active plans without duplicates", async () => {
  const source = await create(), destination = await create({ name: "Destination" });
  const program = await request("/api/programs", "POST", { name: "Merge", exercises: [target(source.id, 10), target(destination.id, 15)] });
  const workout = await request("/api/workouts", "POST", { programId: program.id });
  const draft = { exerciseId: source.id, weightKg: 10, reps: 10, rir: 2, technique: "good" };
  await request(`/api/workouts/${workout.id}/draft`, "PUT", { draft, revision: 0 });
  const beforeDraft = await request(`/api/workouts/${workout.id}/draft`);
  await replace(source.id, { targetExerciseId: destination.id });
  const plan = await loadPlan(workout.id);
  assert.equal(plan.exercises.length, 1);
  assert.equal(plan.exercises[0].exerciseId, destination.id);
  assert.equal(plan.exercises[0].name, "Destination");
  assert.deepEqual(plan.exercises[0].setTargets.map(row => row.weightKg), [10, 15]);
  assert.equal(plan.exercises[0].sets, 2);
  const afterDraft = await request(`/api/workouts/${workout.id}/draft`);
  assert.equal(afterDraft.draft.exerciseId, destination.id);
  assert.equal(afterDraft.draft.rir, 2);
  assert.equal(afterDraft.revision, beforeDraft.revision + 1);
  const savedType = await request(`/api/programs/${program.id}`);
  assert.deepEqual(savedType.exercises[0].setTargets, plan.exercises[0].setTargets);
  await parseProgressBackup(await exportProgress());
});

test("creating a replacement is one atomic operation and cannot leave an orphan on failure", async () => {
  const source = await create();
  const before = new Map(storage);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(replace(source.id, { exercise: { name: "Replacement", muscleGroup: "Грудь", equipment: "dumbbell" } }));
  assert.deepEqual(storage, before);
  const result = await replace(source.id, { exercise: { name: "Replacement", muscleGroup: "Грудь", equipment: "dumbbell" } });
  assert.equal(result.id, source.id + 1);
  assert.equal(state().exercises.filter(ex => ex.isCustom).length, 1);
  assert.ok(!state().exercises.some(ex => ex.deletedAt));
  await assert.rejects(replace(source.id, { targetExerciseId: result.id }), { status: 404 });
});

test("replacements reject incompatible equipment, seconds, assistance, dumbbell counts and IDs", async () => {
  const source = await create();
  const mismatches = [1, 7, 30, source.id, 999];
  const double = await create({ dumbbellCount: 2 }); mismatches.push(double.id);
  const before = new Map(storage);
  for (const id of mismatches) {
    await assert.rejects(replace(source.id, { targetExerciseId: id }), { status: 400 });
    assert.deepEqual(storage, before);
  }
  const machine = await create({ equipment: "machine" });
  const assisted = await create({ equipment: "machine", loadMode: "assisted" });
  assert.equal(canReplaceExercise(machine, assisted), false);
  const plank = await create({ name: "Боковая планка", equipment: "bodyweight" });
  assert.equal(canReplaceExercise(plank, (await request("/api/exercises")).find(ex => ex.id === 7)), false);
  for (const body of [{}, { targetExerciseId: "3" }, { targetExerciseId: 3, exercise: {} }, { exercise: [] }]) await assert.rejects(replace(source.id, body), { status: 400 });
});

test("legacy archives are purged when unused; recorded entries become actionable, never lost", async () => {
  const source = await create(), unused = await create({ name: "Unused" });
  const workout = await request("/api/workouts", "POST");
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: source.id, weightKg: 10, reps: 10 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const legacy = JSON.parse(await exportProgress());
  for (const ex of legacy.state.exercises.filter(ex => [source.id, unused.id].includes(ex.id))) ex.deletedAt = new Date().toISOString();
  await restoreProgress(rehash(legacy));
  const items = await request("/api/exercises/maintenance");
  assert.ok(!state().exercises.some(ex => ex.deletedAt || ex.id === unused.id));
  assert.equal(items.find(row => row.exercise.id === source.id).exercise.replacementPending, true);
  assert.equal(items.find(row => row.exercise.id === source.id).recordedSets, 1);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets[0].weightKg, 10);
  await replace(source.id, { targetExerciseId: 3 });
  assert.ok(!(await request("/api/exercises/maintenance")).some(row => row.exercise.replacementPending));
  await parseProgressBackup(await exportProgress());
});

test("cold-load migration is journaled, idempotent and does not quarantine a storage fault", async () => {
  const source = await create();
  const legacy = state(); legacy.exercises.find(ex => ex.id === source.id).deletedAt = new Date().toISOString();
  storage.set(PROGRESS_KEY, JSON.stringify(legacy));
  const before = new Map(storage);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(request("/api/exercises"));
  assert.deepEqual(storage, before);
  await request("/api/exercises");
  const after = new Map(storage);
  await request("/api/exercises");
  assert.deepEqual(storage, after);
  assert.ok(!state().exercises.some(ex => ex.id === source.id || ex.deletedAt));
});

test("bodyweight and assisted replacements preserve body snapshots and tonnage", async () => {
  for (const settings of [{ equipment: "bodyweight" }, { equipment: "machine", loadMode: "assisted" }]) {
    storage.clear();
    const source = await create(settings);
    await request("/api/profile", "PUT", { bodyWeightKg: 80 });
    const workout = await request("/api/workouts", "POST");
    await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: source.id, weightKg: 10, reps: 8 });
    const before = await request(`/api/workouts/${workout.id}`);
    const result = await replace(source.id, { exercise: { name: "New movement", muscleGroup: "Грудь", ...settings } });
    const after = await request(`/api/workouts/${workout.id}`);
    assert.equal(after.totalVolume, before.totalVolume);
    assert.equal(after.sets[0].bodyWeightKg, 80);
    assert.equal(after.sets[0].exerciseId, result.id);
    await parseProgressBackup(await exportProgress());
  }
});

test("timed replacements update running and transferred timer identities without inventing weights", async () => {
  const workout = await request("/api/workouts", "POST");
  const timer = { kind: "plank", exerciseId: 30, totalMs: 60000, remainingMs: 45000, endsAt: null };
  await request(`/api/workouts/${workout.id}/timer`, "PUT", timer);
  const replacement = await replace(30, { exercise: { name: "Боковая планка", muscleGroup: "Пресс", equipment: "bodyweight" } });
  assert.equal((await request(`/api/workouts/${workout.id}/timer`)).timer.exerciseId, replacement.id);
  const updated = (await request(`/api/workouts/${workout.id}/timer`)).timer;
  await request(`/api/workouts/${workout.id}/draft/transfer`, "POST", { revision: 0, timer: updated });
  const original = await request(`/api/workouts/${workout.id}/draft`);
  const final = await replace(replacement.id, { exercise: { name: "Планка", muscleGroup: "Пресс", equipment: "bodyweight" } });
  const after = await request(`/api/workouts/${workout.id}/draft`);
  assert.equal(after.draft.exerciseId, final.id);
  assert.equal(after.draft.sourceTimer.exerciseId, final.id);
  assert.equal(after.draft.durationSeconds, original.draft.durationSeconds);
  assert.equal(after.draft.weightKg, 0);
  await assert.rejects(request(`/api/workouts/${workout.id}/draft/commit`, "POST", { revision: original.revision }), { status: 409 });
  await parseProgressBackup(await exportProgress());
});

test("merge writes roll back both saved types and active plans, not just newly created rows", async () => {
  const source = await create(), destination = await create({ name: "Destination" });
  const program = await request("/api/programs", "POST", { name: "Rollback", exercises: [target(source.id, 10)] });
  await request("/api/workouts", "POST", { programId: program.id });
  const before = new Map(storage);
  globalThis.__failMultiSetOnce = true;
  await assert.rejects(replace(source.id, { targetExerciseId: destination.id }));
  assert.deepEqual(storage, before);
  await parseProgressBackup(await exportProgress());
});

test("merging two achieved exercises never counts the same destination twice towards any-three levels", async () => {
  const workout = await request("/api/workouts", "POST");
  for (const id of [21, 22, 24]) await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: id, weightKg: 20, reps: 10 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.ok((await request("/api/levels")).currentLevel > 0);
  await replace(21, { targetExerciseId: 22 });
  assert.equal((await request("/api/levels")).currentLevel, 0);
  assert.equal(state().sets.length, 3);
  assert.ok(!state().exercises.some(ex => ex.deletedAt));
});

test("editor saving stays in the fixed header and Android keeps native resize without double avoidance", () => {
  const editor = readFileSync(new URL("../components/ExerciseEditor.tsx", import.meta.url), "utf8");
  const headerEnd = editor.indexOf('<ScrollView');
  assert.ok(editor.indexOf('accessibilityLabel={saveTitle}') < headerEnd);
  assert.match(editor, /behavior=\{Platform\.OS === "ios" \? "padding" : undefined\}/);
  assert.match(editor, /GestureHandlerRootView/);
  assert.match(editor, /keyboardShouldPersistTaps="handled"/);
});
