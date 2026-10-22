import assert from "node:assert/strict";
import { beforeEach, afterEach, test, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { buildNextExercisePrediction } = await import("../lib/trainingPrediction.ts");
const { PROGRESS_KEY, PLAN_PREFIX } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { coachFingerprint } = await import("../lib/aiCoachConnection.ts");
const { calibrateRemaining } = await import("../lib/workoutTemplates.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
beforeEach(() => { storage.clear(); delete globalThis.__storageFault; });
afterEach(() => { delete globalThis.__storageFault; mock.timers.reset(); });
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const preview = () => request("/api/daily-workout");
const start = data => request("/api/daily-workout/start", "POST", { fingerprint: data.fingerprint, plan: data.plan });
async function record(id = 1, weightKg = 60, reps = 8, ratings = { rir: 2, technique: "good" }) {
  const w = await request("/api/workouts", "POST");
  for (let i = 0; i < 3; i++) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: id, weightKg, reps, ...ratings });
  await request(`/api/workouts/${w.id}/finish`, "POST"); return w;
}
const template = (name, exerciseId) => request("/api/programs", "POST", { name, exercises: [{ exerciseId, sets: 3, repsMin: 8, repsMax: 12, intent: "hypertrophy" }] });

test("daily preview is deterministic, offline/read-only and has concrete safe targets without creating programs", async () => {
  await request("/api/exercises"); const saved = new Map(storage);
  const a = await preview(), b = await preview();
  assert.deepEqual(a, b); assert.deepEqual(storage, saved); assert.equal(a.source, "balanced");
  assert.ok(a.plan.exercises.length >= 3); assert.equal(a.activeWorkoutId, null);
  for (const ex of a.plan.exercises) for (const target of ex.setTargets) {
    assert.ok(Number.isFinite(target.weightKg));
    if (ex.equipment === "barbell") assert.ok(target.weightKg >= 20);
    if (ex.name === "Планка") assert.ok(target.durationSeconds > 0 && target.weightKg === 0 && target.reps === 0);
  }
  assert.equal(state().customPrograms.length, 0); assert.equal(state().workouts.length, 0);
});
test("accept creates one atomic plan+draft, concurrent taps resume it and do not log performed sets", async () => {
  const p = await preview(); const [a, b] = await Promise.all([start(p), start(p)]);
  assert.equal(a.id, b.id); assert.equal(state().workouts.length, 1); assert.equal(state().sets.length, 0);
  assert.equal((await preview()).activeWorkoutId, a.id);
  const plan = await loadPlan(a.id), draft = await request(`/api/workouts/${a.id}/draft`);
  assert.deepEqual(plan.exercises[0].setTargets, p.plan.exercises[0].setTargets);
  assert.equal(draft.draft.exerciseId, plan.exercises[0].exerciseId);
  assert.equal(draft.draft.weightKg, plan.exercises[0].setTargets[0].weightKg);
});
test("declining starts the ordinary empty workout and does not save or consume a suggested plan", async () => {
  await preview(); const w = await request("/api/workouts", "POST", {});
  assert.equal(await loadPlan(w.id), null); assert.equal((await request(`/api/workouts/${w.id}/draft`)).draft, null);
  assert.equal(w.sets.length, 0); assert.equal(state().customPrograms.length, 0);
});
test("stale date or changed profile cannot apply a stale suggestion", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 21, 23, 58).getTime() });
  const p = await preview(); mock.timers.tick(5 * 60000);
  await assert.rejects(start(p), { status: 409 }); assert.equal(state().workouts.length, 0);
  const next = await preview(); assert.notEqual(next.date, p.date);
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "strength" });
  await assert.rejects(start(next), { status: 409 });
});
test("an existing active workout wins over any pending offer, preserving its sets and draft", async () => {
  const p = await preview(), active = await request("/api/workouts", "POST");
  await request(`/api/workouts/${active.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8 });
  const saved = new Map(storage); assert.equal((await start(p)).id, active.id); assert.deepEqual(storage, saved);
});
test("without a month the plan uses all history, not the previous custom template name", async () => {
  await template("Push fixture", 1); await template("Pull fixture", 8);
  const p = await preview(); assert.equal(p.source, "balanced");
  assert.match(p.plan.name, /^Сплит · /);
  const w = await start(p);
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  const next = await preview();
  assert.equal(next.source, "balanced");
  assert.match(next.plan.name, /^Сплит · /);
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), equipment: ["bodyweight"] });
  assert.ok((await preview()).plan.exercises.every(ex => ex.equipment === "bodyweight"));
});
test("no compatible catalog still permits a manual start and does not invent exercises", async () => {
  await request("/api/exercises"); const raw = state(); raw.exercises = [];
  const value = buildDailyWorkout(raw); assert.equal(value.plan, null); assert.equal(raw.exercises.length, 0);
});
test("split stays within its muscle families and favors main patterns over heavily trained isolation", async () => {
  await request("/api/exercises");
  const raw = state(), date = "2026-10-22T12:00:00Z";
  // Known isolation is not a reason to omit the unfamiliar compound shoulder press.
  raw.workouts = [
    { id: 101, name: null, startedAt: "2026-09-15T10:00:00Z", finishedAt: "2026-09-15T11:00:00Z" },
    { id: 102, name: null, startedAt: "2026-10-21T10:00:00Z", finishedAt: "2026-10-21T11:00:00Z" },
    { id: 103, name: null, startedAt: "2026-10-21T12:00:00Z", finishedAt: "2026-10-21T13:00:00Z" },
  ];
  raw.sets = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: 1000 + i, workoutId: 101, exerciseId: 21, reps: 12,
      weightKg: 10, rir: 2, technique: "good", createdAt: "2026-09-15T10:05:00Z",
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: 2000 + i, workoutId: 102, exerciseId: 7, reps: 8,
      weightKg: 0, rir: 2, technique: "good", createdAt: "2026-10-21T10:10:00Z",
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: 3000 + i, workoutId: 103, exerciseId: 14, reps: 10,
      weightKg: 80, rir: 2, technique: "good", createdAt: "2026-10-21T12:10:00Z",
    })),
  ];
  const result = buildDailyWorkout(raw, new Date(date));
  assert.equal(result.source, "balanced");
  assert.match(result.plan.name, /^Сплит · Грудь/);
  assert.equal(result.plan.exercises.length, 5);
  const groups = new Set(result.plan.exercises.map(ex => ex.muscleGroup));
  assert.ok([...groups].every(group => ["Грудь", "Плечи", "Трицепс"].includes(group)));
  assert.equal(result.plan.exercises[0].exerciseId, 1);
  assert.equal(result.plan.exercises[2].exerciseId, 19, "shoulder press precedes familiar lateral raise");
  assert.equal(result.plan.exercises[3].exerciseId, 21, "lateral raise remains an accessory");
  assert.equal(result.plan.exercises.reduce((sum, ex) => sum + ex.sets, 0), 13);
});

test("all recorded sessions, not the last workout, determine the next split day", async () => {
  await request("/api/exercises");
  const raw = state(), base = Date.parse("2026-10-22T12:00:00Z");
  const done = (id, exerciseId, hoursAgo, sets = 3) => {
    const date = new Date(base - hoursAgo * 3600000).toISOString();
    raw.workouts.push({ id, name: null, startedAt: date, finishedAt: date });
    for (let i = 0; i < sets; i++) raw.sets.push({
      id: id * 100 + i, workoutId: id, exerciseId, reps: 10,
      weightKg: 40, rir: 2, technique: "good", createdAt: date,
    });
  };
  done(101, 1, 96, 12); // push
  done(102, 1, 72, 12); // push
  done(103, 7, 96, 3); // pull
  done(104, 14, 24, 6); // legs is last, but pull is least loaded
  const choice = buildDailyWorkout(raw, new Date(base));
  assert.match(choice.plan.name, /^Сплит · Спина/);
  assert.ok(choice.plan.exercises.every(ex => ["Спина", "Бицепс"].includes(ex.muscleGroup)));
  assert.ok(choice.plan.exercises.some(ex => ex.exerciseId === 7));
  assert.ok(choice.plan.exercises.some(ex => ex.exerciseId === 8 || ex.exerciseId === 11));
});

test("stored single 85 x 1 never defines the next push day's working prescription", async () => {
  await request("/api/exercises");
  const raw = state();
  const d = "2026-10-15T12:00:00Z";
  raw.workouts = [{ id: 105, name: null, startedAt: d, finishedAt: d }];
  raw.sets = [{ id: 500, workoutId: 105, exerciseId: 1, weightKg: 85, reps: 1,
    rir: null, technique: "good", createdAt: d }];
  const proposal = buildDailyWorkout(raw, new Date("2026-10-22T12:00:00Z"));
  const bench = proposal.plan.exercises.find(ex => ex.exerciseId === 1);
  assert.ok(bench);
  assert.ok(bench.setTargets.every(target => target.reps >= 6 && !(target.weightKg === 85 && target.reps === 1)));
});

test("a three-session history naturally rotates push, pull and legs without a monthly plan", async () => {
  await request("/api/exercises");
  const raw = state(), now = new Date("2026-10-22T12:00:00Z");
  const addFinished = (workoutId, exerciseId, hoursAgo) => {
    const date = new Date(now.getTime() - hoursAgo * 3600000).toISOString();
    raw.workouts.push({ id: workoutId, name: null, startedAt: date, finishedAt: date });
    for (let i = 0; i < 3; i++) raw.sets.push({
      id: workoutId * 100 + i, workoutId, exerciseId,
      weightKg: 40, reps: 10, rir: 2, technique: "good", createdAt: date,
    });
  };
  assert.match(buildDailyWorkout(raw, now).plan.name, /^Сплит · Грудь/);
  addFinished(601, 1, 72);
  assert.match(buildDailyWorkout(raw, now).plan.name, /^Сплит · Спина/);
  addFinished(602, 7, 48);
  assert.match(buildDailyWorkout(raw, now).plan.name, /^Сплит · Ноги/);
  addFinished(603, 14, 24);
  assert.match(buildDailyWorkout(raw, now).plan.name, /^Сплит · Грудь/);
});

test("calf press catalogued under legs cannot replace a compound quad movement", async () => {
  await request("/api/exercises");
  const raw = state(), now = new Date("2026-10-22T12:00:00Z");
  const calf = { ...raw.exercises.find(ex => ex.id === 14), id: 99, name: "Жим ногами сидя на икры", muscleGroup: "Ноги" };
  raw.exercises.push(calf);
  // Make legs the least recently worked split, even with the calf session.
  for (const [id, exerciseId, n] of [[201, 1, 9], [202, 7, 9], [203, 99, 3]]) {
    const date = "2026-10-20T10:00:00Z";
    raw.workouts.push({ id, name: null, startedAt: date, finishedAt: date });
    for (let i = 0; i < n; i++) raw.sets.push({ id: id * 100 + i,
      workoutId: id, exerciseId, weightKg: 50, reps: 12,
      rir: 2, technique: "good", createdAt: date });
  }
  const choice = buildDailyWorkout(raw, now);
  assert.match(choice.plan.name, /^Сплит · Ноги/);
  assert.equal(choice.plan.exercises[0].exerciseId, 12, "squat is the first quad pattern, not calf press");
  assert.ok(choice.plan.exercises.slice(0, 3).every(ex => ex.exerciseId !== 99));
  assert.ok(choice.plan.exercises.every(ex => ["Ноги", "Икры", "Пресс"].includes(ex.muscleGroup)));
});

test("familiar unilateral leg press beats unknown squat, but calf press stays accessory", async () => {
  await request("/api/exercises");
  const raw = state(), now = new Date("2026-10-22T12:00:00Z");
  raw.exercises.push({ ...raw.exercises.find(ex => ex.id === 14),
    id: 43, name: "Жим одной ногой", muscleGroup: "Ноги", isMain: false });
  raw.exercises.push({ ...raw.exercises.find(ex => ex.id === 14),
    id: 41, name: "Жим ногами сидя на икры", muscleGroup: "Ноги", isMain: false });
  const entries = [
    { workoutId: 301, exerciseId: 1, sets: 9 },
    { workoutId: 302, exerciseId: 7, sets: 9 },
    { workoutId: 303, exerciseId: 43, sets: 3 },
    { workoutId: 304, exerciseId: 41, sets: 2 },
    { workoutId: 305, exerciseId: 17, sets: 2 },
  ];
  for (const item of entries) {
    const date = "2026-10-20T10:00:00Z";
    raw.workouts.push({ id: item.workoutId, name: null, startedAt: date, finishedAt: date });
    for (let i = 0; i < item.sets; i++) raw.sets.push({
      id: item.workoutId * 100 + i, workoutId: item.workoutId,
      exerciseId: item.exerciseId, weightKg: 60, reps: 12,
      rir: 2, technique: "good", createdAt: date,
    });
  }
  const workout = buildDailyWorkout(raw, now);
  assert.match(workout.plan.name, /^Сплит · Ноги/);
  assert.equal(workout.plan.exercises[0].exerciseId, 43);
  assert.ok(workout.plan.exercises.slice(0, 3).every(ex => ex.exerciseId !== 41));
  assert.ok(workout.plan.exercises.some(ex => ex.exerciseId === 17), "leg extensions remain optional accessories");
});

test("future and unfinished workouts do not influence independent exercise selection", async () => {
  await request("/api/exercises");
  const raw = state();
  raw.workouts = [
    { id: 201, name: null, startedAt: "2026-10-23T10:00:00Z", finishedAt: "2026-10-23T11:00:00Z" },
    { id: 202, name: null, startedAt: "2026-10-22T10:00:00Z", finishedAt: null },
  ];
  raw.sets = [201, 202].map(id => ({ id, workoutId: id, exerciseId: 18, reps: 12, weightKg: 100, createdAt: "2026-10-22T10:00:00Z" }));
  const preview = buildDailyWorkout(raw, new Date("2026-10-22T12:00:00Z"));
  const empty = buildDailyWorkout({ ...raw, workouts: [], sets: [] }, new Date("2026-10-22T12:00:00Z"));
  assert.deepEqual(preview.plan.exercises.map(x => x.exerciseId), empty.plan.exercises.map(x => x.exerciseId));
});

test("known exercise weights use the actual recorded working sets, not sport rank", async () => {
  await record(3, 20, 8);
  const calculated = buildNextExercisePrediction(state(), 3, Date.now(), { sets: 3, repsMin: 8, repsMax: 12 });
  assert.ok(calculated.next.weightKg >= 17.5);
  assert.notEqual(calculated.next.action, "calibrate");
});
test("new dumbbell bench uses a conservative analog, and first-set assessment remains mandatory", async () => {
  await record(1, 60, 8);
  const calculated = buildNextExercisePrediction(state(), 3, Date.now(), { sets: 3, repsMin: 8, repsMax: 12 });
  assert.equal(calculated.next.weightKg, 17.5);
  assert.equal(calculated.next.action, "calibrate");
  assert.equal(calculated.calibrationBasis?.sourceExerciseId, 1);
  const p = await preview();
  assert.equal(p.source, "balanced");
  assert.ok(p.plan.exercises.length > 0);
});
test("unknown source effort is discounted; singles, failed technique and unrelated moves are not analogs", async () => {
  await record(1, 60, 8, {});
  assert.equal(buildNextExercisePrediction(state(), 3, Date.now()).next.weightKg, 12.5);
  storage.clear(); await record(1, 85, 1, {});
  assert.equal(buildNextExercisePrediction(state(), 3, Date.now()).next.weightKg, 2.5);
  storage.clear(); await record(1, 60, 8, { rir: 2, technique: "breakdown" });
  assert.equal(buildNextExercisePrediction(state(), 3, Date.now()).next.weightKg, 2.5);
  storage.clear(); await record(1, 60, 8);
  assert.equal(buildNextExercisePrediction(state(), 23, Date.now()).next.weightKg, 20);
});
test("own low-rep assessed history calibrates via the formula before consulting another exercise", async () => {
  await record(3, 20, 4);
  const prediction = buildNextExercisePrediction(state(), 3, Date.now());
  assert.equal(prediction.next.weightKg, 17.5); assert.equal(prediction.calibrationBasis.sourceExerciseId, 3);
});
test("monthly AI plans are normalized to numeric own/analog estimates even if the model proposed generic 2.5 kg", async () => {
  await record(1, 60, 8);
  const context = await request("/api/ai-coach/context", "POST", { task: "month_plan" });
  assert.equal(context.calibrationEstimates.find(ex => ex.exerciseId === 3).weightKg, 17.5);
  const plan = { name: "Monthly", description: "", exercises: [{ exerciseId: 3, reason: "Check first set", targets: [{ weightKg: 2.5, reps: 10, durationSeconds: null }] }] };
  const reply = validateCoachReply({ summary: "Monthly", cautions: [], nextSet: null, plan: null, monthly: { name: "Month", overview: "Local math", daysPerWeek: 3, templates: [plan], weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Consistency", sessions: [0, 0, 0] })) } }, context);
  assert.equal(reply.monthly.templates[0].exercises[0].targets[0].weightKg, 17.5);
  assert.equal(reply.monthly.templates[0].exercises[0].targets[0].reps, 8);
});

test("own numerical targets remain usable when that exercise is outside the last twelve transmitted sessions", async () => {
  await record(3, 20, 8);
  for (let i = 0; i < 12; i++) await record(1, 60, 8);
  const context = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  assert.ok(context.sessions.every(session => session.sets.every(set => set.exerciseId !== 3)));
  const result = validateCoachReply({ summary: "Own history is retained by the app", cautions: [], nextSet: null,
    plan: { name: "DB", description: "", exercises: [{ exerciseId: 3, reason: "Own measured working history", targets: [{ weightKg: 2.5, reps: 8, durationSeconds: null }] }] } }, context);
  assert.ok(result.plan.exercises[0].targets[0].weightKg >= 17.5);
});
test("optional AI receives the actual prepared workout and no request is required to start it", async () => {
  const p = await preview(); const context = await request("/api/ai-coach/context", "POST", { task: "next_workout" });
  assert.deepEqual(context.preparedWorkout.exercises.map(ex => ex.exerciseId), p.plan.exercises.map(ex => ex.exerciseId));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network must not be used by local start"); };
  try { assert.ok((await start(p)).id > 0); } finally { globalThis.fetch = previousFetch; }
});
test("a first easy calibration cannot automatically add a large equipment step", () => {
  const exercise = { calibration: true, equipment: "dumbbell", suggestedWeightKg: 20, weightStepKg: 10, setTargets: [{ weightKg: 20, reps: 8 }, { weightKg: 20, reps: 8 }] };
  const result = calibrateRemaining(exercise, { weightKg: 20, reps: 8, rir: 4, technique: "good" }, 1);
  assert.equal(result.setTargets[1].weightKg, 20); assert.match(result.note, /вручную/);
});

test("hypertrophy month with five 85 kg singles never becomes five heavy singles", async () => {
  await record(1, 85, 1, {});
  const context = await request("/api/ai-coach/context", "POST", { task: "month_plan" });
  const monthly = { name: "Legacy singles", overview: "Regression", daysPerWeek: 3,
    templates: [{ name: "Chest", description: "", exercises: [{ exerciseId: 1, reason: "Historical maximum",
      targets: Array.from({ length: 5 }, () => ({ weightKg: 85, reps: 1, durationSeconds: null })) }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Train", sessions: [0, 0, 0] })) };
  await request("/api/ai-coach/month", "PUT", { context, fingerprint: await coachFingerprint(context), monthly });
  const proposal = await preview();
  assert.equal(proposal.source, "month");
  const bench = proposal.plan.exercises.find(ex => ex.exerciseId === 1);
  assert.ok(bench);
  assert.ok(bench.repsMin >= 6);
  assert.ok(bench.setTargets.every(set => set.reps >= bench.repsMin));
  assert.ok(bench.setTargets.every(set => !(set.weightKg === 85 && set.reps === 1)));
});

test("the saved month wins over custom types; only completion consumes its next slot", async () => {
  await template("Do not override the month", 1);
  const context = await request("/api/ai-coach/context", "POST", { task: "month_plan" });
  const monthly = { name: "Month fixture", overview: "Next unfinished session", daysPerWeek: 3,
    templates: [{ name: "Timed month fixture", description: "", exercises: [{ exerciseId: 30, reason: "Core", targets: [{ weightKg: 0, reps: 0, durationSeconds: 45 }] }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "Consistency", sessions: [0, 0, 0] })) };
  await request("/api/ai-coach/month", "PUT", { context, fingerprint: await coachFingerprint(context), monthly });
  let p = await preview(); assert.equal(p.source, "month"); assert.equal(p.scheduled.slot, 0);
  assert.equal(p.plan.exercises[0].setTargets[0].durationSeconds, 45);
  const manual = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${manual.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8 });
  await request(`/api/workouts/${manual.id}/finish`, "POST", {});
  p = await preview(); assert.equal(p.scheduled.slot, 0);
  const w = await start(p); assert.equal((await preview()).scheduled.slot, 0);
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45 });
  await request(`/api/workouts/${w.id}/finish`, "POST", {});
  assert.equal((await preview()).scheduled.slot, 1);
  await request(`/api/workouts/${w.id}`, "DELETE");
  assert.equal((await preview()).scheduled.slot, 0);
});

for (const keyType of ["state", "plan"]) test(`interrupted daily ${keyType} write recovers one complete workout, plan and draft`, async () => {
  const p = await preview(), nextId = state().nextWorkoutId; let fired = false;
  globalThis.__storageFault = ({ operation, key, phase }) => {
    if (!fired && operation === "multiSet" && phase === "after" && key === (keyType === "state" ? PROGRESS_KEY : PLAN_PREFIX + nextId)) { fired = true; throw new Error("Interrupted daily start"); }
  };
  try { await start(p); } catch (e) { assert.match(e.message, /Interrupted|сохран|запис/i); }
  delete globalThis.__storageFault;
  const w = await start(p);
  assert.equal(fired, true); assert.equal(state().workouts.length, 1); assert.equal(state().sets.length, 0);
  assert.ok((await loadPlan(w.id)).exercises.length > 0);
  assert.ok((await request(`/api/workouts/${w.id}/draft`)).draft);
});

test("related calibration rejects stale observations and equipment recategorization", async () => {
  await record(1, 60, 8); const saved = state();
  const future = Date.now() + 29 * 86400000;
  assert.equal(buildNextExercisePrediction(saved, 3, future).calibrationBasis, null);
  saved.exercises.find(ex => ex.id === 1).equipment = "machine";
  assert.equal(buildNextExercisePrediction(saved, 3, Date.now()).calibrationBasis, null);
});
test("daily workout and its plan survive a backup round-trip without recording extra approaches", async () => {
  const w = await start(await preview()); const plan = await loadPlan(w.id), copy = await exportProgress();
  await restoreProgress(copy); assert.deepEqual(await loadPlan(w.id), plan);
  assert.equal(state().sets.length, 0); assert.equal(state().workouts.length, 1);
});
