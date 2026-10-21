import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { nextWorkingLoad, weeklyWork, startTimer, pauseTimer, resumeTimer, remainingMs, extendTimer } = await import("../lib/trainingCoach.ts");
const { completedTargets, editableTemplateExercise, templateFromWorkout, withSetTargets } = await import("../lib/workoutTemplates.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
beforeEach(() => storage.clear());

const definition = (exerciseId = 1) => ({ exerciseId, sets: 3, repsMin: 8, repsMax: 12, intent: "hypertrophy", weightStepKg: 2.5, targetRir: 2, setTargets: Array.from({ length: 3 }, () => exerciseId === 30 ? { weightKg: 0, reps: 0, durationSeconds: 30, setType: "working" } : { weightKg: 20, reps: 8, setType: "working" }) });
test("workout types can be created before training, reordered and updated without touching history", async () => {
  const created = await request("/api/programs", "POST", { name: "A", exercises: [definition(), definition(30)] });
  let plan = await request(`/api/programs/${created.id}`);
  assert.equal(plan.exercises[0].repsMax, 12);
  assert.equal(plan.exercises[0].weightStepKg, 2.5);
  assert.equal(editableTemplateExercise(plan.exercises[0]).repsMax, 12);
  assert.equal((await request("/api/workouts")).length, 0);
  await request(`/api/programs/${created.id}`, "PUT", { name: "B", exercises: [plan.exercises[1], { ...plan.exercises[0], weightStepKg: 1.25, targetRir: 3 }] });
  plan = await request(`/api/programs/${created.id}`);
  assert.deepEqual(plan.exercises.map(ex => ex.exerciseId), [30, 1]);
  assert.equal(plan.exercises[1].weightStepKg, 1.25);
  assert.equal(plan.exercises[1].targetRir, 3);
  const snapshot = await exportProgress();
  await restoreProgress(snapshot);
  assert.deepEqual((await request(`/api/programs/${created.id}`)).exercises, plan.exercises);
  await assert.rejects(request("/api/programs", "POST", { name: "Bad", exercises: [{ ...definition(), weightStepKg: 0 }] }));
  await assert.rejects(request("/api/programs", "POST", { name: "Bad", exercises: [{ ...definition(), targetRir: 6 }] }));
  await assert.rejects(request("/api/programs", "POST", { name: "Bad", exercises: [definition(), definition()] }));
});

test("coach fields round-trip and every new approach is working", async () => {
  const workout = await request("/api/workouts", "POST", {});
  const url = `/api/workouts/${workout.id}/sets`;
  const old = await request(url, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  assert.equal(old.setType, "working");
  const set = await request(url, "POST", { exerciseId: 1, weightKg: 30, reps: 12, setType: "working", rir: 2, technique: "good" });
  assert.equal(set.rir, 2);
  assert.equal(set.technique, "good");
  for (const invalid of [{ rir: -1 }, { rir: 6 }, { rir: 1.5 }, { technique: "perfect" }, { setType: "other" }]) await assert.rejects(request(url, "POST", { exerciseId: 1, weightKg: 20, reps: 10, ...invalid }));
  await assert.rejects(request(url, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 30, rir: 2 }));
  const snapshot = await exportProgress();
  assert.equal(JSON.parse(snapshot).version, 10);
  await restoreProgress(snapshot);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets[0].setType, "working");
  assert.deepEqual((await request(`/api/workouts/${workout.id}`)).sets[1], set);
  const legacy = JSON.parse(snapshot); legacy.version = 3;
  await parseProgressBackup(JSON.stringify(legacy));
});

test("every historical approach completes a plan regardless of its former type", () => {
  const plan = { ...definition(), name: "Bench", equipment: "barbell", suggestedWeightKg: 20 };
  const warmup = { exerciseId: 1, setType: "warmup" };
  const working = { exerciseId: 1, setType: "working" };
  assert.equal(completedTargets(plan, [warmup, warmup, warmup]), 3);
  assert.equal(completedTargets(plan, [warmup, working]), 2);
  const withWarmup = { ...plan, sets: 4, setTargets: [{ weightKg: 20, reps: 10, setType: "warmup" }, ...plan.setTargets] };
  assert.equal(completedTargets(withWarmup, [warmup, working]), 2);
});

test("temporary empty or zero reps in the editor cannot poison the progression range", () => {
  const plan = { ...definition(), name: "Bench", equipment: "barbell", suggestedWeightKg: 20 };
  for (const invalid of [NaN, 0, -1, 1.5]) {
    const draft = withSetTargets(plan, [{ ...plan.setTargets[0], reps: invalid }, ...plan.setTargets.slice(1)], true);
    assert.equal(draft.repsMin, 8);
    assert.equal(draft.repsMax, 12);
    const fixed = withSetTargets(draft, plan.setTargets, true);
    assert.equal(fixed.repsMin, 8);
    assert.equal(fixed.repsMax, 12);
  }
});

test("saving a completed workout counts all approaches in its rep range", async () => {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 20, setType: "warmup" });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 10, setType: "working", rir: 2, technique: "good" });
  const finished = (await request(`/api/workouts/${workout.id}/finish`, "POST")).workout;
  const [template] = templateFromWorkout(finished);
  assert.equal(template.repsMax, 20);
  assert.equal(template.setTargets[0].setType, "working");
  assert.equal(template.setTargets[1].rir, undefined);
  assert.equal(template.setTargets[1].technique, undefined);
});

test("double progression requires the full comparable session, RIR and technique", () => {
  const goal = { ...definition(), equipment: "barbell" };
  const sets = Array.from({ length: 3 }, (_, i) => ({ exerciseId: 1, workoutId: 1, createdAt: new Date(2026, 9, 10, 10, i).toISOString(), weightKg: 40, reps: 12, rir: 2, technique: "good", setType: "working" }));
  const two = [...sets, ...sets.map(row => ({ ...row, workoutId: 2, createdAt: row.createdAt.replace("10T", "11T") }))];
  assert.equal(nextWorkingLoad(sets, goal).weightKg, 40);
  assert.equal(nextWorkingLoad(two, goal).weightKg, 42.5);
  assert.equal(nextWorkingLoad([...two].reverse(), goal).weightKg, 42.5);
  assert.equal(nextWorkingLoad([...sets, { ...sets[0], setType: "warmup", weightKg: 20 }], goal).weightKg, 40);
  for (const changed of [{ reps: 11 }, { rir: 1 }, { rir: null }, { technique: "breakdown" }, { technique: null }, { weightKg: 35 }]) assert.equal(nextWorkingLoad([sets[0], sets[1], { ...sets[2], ...changed }], goal).increase, false);
  assert.equal(nextWorkingLoad(sets.slice(0, 2), goal).increase, false);
  assert.equal(nextWorkingLoad([...sets, { ...sets[0], workoutId: 2, reps: 8, createdAt: new Date(2026, 9, 11).toISOString() }], goal).increase, false);
  assert.equal(nextWorkingLoad(two.map(({ setType, ...old }) => old), goal).weightKg, 42.5);
  assert.equal(nextWorkingLoad(two, { ...goal, weightStepKg: 1.25 }).weightKg, 41.25);
  assert.equal(nextWorkingLoad(two, { ...goal, weightStepKg: 5 }).weightKg, 40);
  assert.equal(nextWorkingLoad(two, goal, new Date(2027, 0, 1).getTime()).increase, false);
  assert.equal(nextWorkingLoad(two.map(({ workoutId, ...row }) => row), goal).increase, false);
});

test("weekly volume includes all approaches and counts local training days", async () => {
  const now = new Date(2026, 9, 13, 12);
  const record = (day, setType, extra = {}) => ({ exerciseId: 1, weightKg: 20, reps: 8, createdAt: new Date(2026, 9, day, 10).toISOString(), muscleGroup: "Chest", setType, ...extra });
  const rows = weeklyWork([record(7, "working"), record(7, "working"), record(13, "working"), record(13, "warmup"), record(13, undefined), record(6, "working"), record(14, "working")], now);
  assert.deepEqual(rows[0], { muscleGroup: "Chest", workingSets: 5, trainingDays: 2 });
  const active = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${active.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, setType: "working" });
  assert.deepEqual((await request("/api/stats/weekly")).groups, []);
  await request(`/api/workouts/${active.id}/finish`, "POST");
  assert.equal((await request("/api/stats/weekly")).groups[0].workingSets, 1);
});

test("timers use absolute deadlines, persist pauses and survive backup and app reload", async () => {
  let timer = startTimer("rest", 120, undefined, 100000);
  assert.equal(remainingMs(timer, 130000), 90000);
  timer = pauseTimer(timer, 130000);
  assert.equal(remainingMs(timer, 900000), 90000);
  timer = resumeTimer(timer, 900000);
  assert.equal(remainingMs(timer, 920000), 70000);
  timer = extendTimer(timer, 30, 920000);
  assert.equal(remainingMs(timer, 920000), 100000);
  assert.equal(remainingMs(timer, 2000000), 0);
  const active = await request("/api/workouts", "POST", {});
  const url = `/api/workouts/${active.id}/timer`;
  await request(url, "POST", { restSeconds: 180 });
  timer = startTimer("plank", 30, 30);
  await request(url, "PUT", timer);
  assert.deepEqual((await request(url)).timer, timer);
  assert.equal((await request(url)).restSeconds, 180);
  const snapshot = await exportProgress();
  await request(url, "DELETE");
  await restoreProgress(snapshot);
  assert.deepEqual((await request(url)).timer, timer);
  await assert.rejects(request(url, "PUT", { ...timer, exerciseId: 1 }));
  await assert.rejects(request(url, "PUT", { ...timer, remainingMs: 999999999 }));
  await request(`/api/workouts/${active.id}/finish`, "POST");
  assert.equal((await request(url)).timer, null);
  await assert.rejects(request(url, "PUT", timer));
});

test("deleting a live custom plank clears its timer and preserves backup references", async () => {
  const exercise = await request("/api/exercises", "POST", { name: "Боковая планка", muscleGroup: "Пресс", equipment: "bodyweight" });
  const workout = await request("/api/workouts", "POST", {});
  const url = `/api/workouts/${workout.id}/timer`;
  await request(url, "PUT", startTimer("plank", 30, exercise.id));
  await assert.rejects(request(`/api/exercises/${exercise.id}`, "PATCH", { name: "Other" }));
  await parseProgressBackup(await exportProgress());
  await request(`/api/exercises/${exercise.id}`, "DELETE");
  assert.equal((await request(url)).timer, null);
  await parseProgressBackup(await exportProgress());
});

test("training journey: 3x12 leads to the next load, a difficult session holds it", async () => {
  const template = await request("/api/programs", "POST", { name: "Journey", exercises: [definition()] });
  const goal = (await request(`/api/programs/${template.id}`)).exercises[0];
  for (const [reps, rir, expected] of [[12, 2, 20], [12, 2, 22.5], [9, 1, 20]]) {
    const workout = await request("/api/workouts", "POST", { programId: template.id });
    for (let i = 0; i < 3; i++) await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps, rir, technique: "good", setType: "working" });
    await request(`/api/workouts/${workout.id}/finish`, "POST");
    const recorded = await request("/api/exercises/1/working-load");
    assert.equal(nextWorkingLoad(recorded.sets, goal).weightKg, expected);
  }
  const stats = await request("/api/stats/weekly");
  assert.equal(stats.groups[0].workingSets, 9);
  const before = JSON.parse(storage.get(PROGRESS_KEY));
  const snapshot = await exportProgress();
  await restoreProgress(snapshot);
  assert.deepEqual(JSON.parse(storage.get(PROGRESS_KEY)), before);
});
