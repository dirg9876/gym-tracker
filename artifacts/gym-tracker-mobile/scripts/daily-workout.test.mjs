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
  assert.equal(p.plan.name, "Тренировка на сегодня");
  const w = await start(p);
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${w.id}/finish`, "POST");
  const next = await preview();
  assert.equal(next.source, "balanced");
  assert.equal(next.plan.name, "Тренировка на сегодня");
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), equipment: ["bodyweight"] });
  assert.ok((await preview()).plan.exercises.every(ex => ex.equipment === "bodyweight"));
});
test("no compatible catalog still permits a manual start and does not invent exercises", async () => {
  await request("/api/exercises"); const raw = state(); raw.exercises = [];
  const value = buildDailyWorkout(raw); assert.equal(value.plan, null); assert.equal(raw.exercises.length, 0);
});
test("all-history planner favors established compound lifts over last-session isolation, and balances muscle groups", async () => {
  await request("/api/exercises");
  const raw = state();
  const time = "2026-10-22T12:00:00Z";
  const sessions = [
    { id: 101, exerciseId: 14, date: "2026-08-20T10:00:00Z", reps: 10, weight: 90 },
    { id: 102, exerciseId: 1, date: "2026-09-15T10:00:00Z", reps: 10, weight: 60 },
    { id: 103, exerciseId: 10, date: "2026-09-25T10:00:00Z", reps: 10, weight: 50 },
    { id: 104, exerciseId: 17, date: "2026-10-20T10:00:00Z", reps: 12, weight: 55 },
    { id: 105, exerciseId: 1, date: "2026-10-21T10:00:00Z", reps: 1, weight: 85 },
  ];
  raw.workouts = sessions.map(x => ({ id: x.id, name: null, startedAt: x.date, finishedAt: x.date }));
  raw.sets = sessions.flatMap(x => Array.from({ length: 3 }, (_, k) => ({
    id: x.id * 10 + k, workoutId: x.id, exerciseId: x.exerciseId, reps: x.reps,
    weightKg: x.weight, rir: x.reps === 1 ? null : 2,
    technique: "good", createdAt: x.date,
  })));
  const result = buildDailyWorkout(raw, new Date(time));
  assert.equal(result.source, "balanced");
  assert.equal(result.plan.exercises.length, 5);
  assert.equal(result.plan.exercises.reduce((sum, ex) => sum + ex.sets, 0), 14);
  const groups = new Set(result.plan.exercises.map(ex => ex.muscleGroup));
  for (const group of ["Ноги", "Спина", "Грудь", "Плечи"]) assert.ok(groups.has(group), group);
  assert.ok(result.plan.exercises.some(ex => ex.exerciseId === 14), "older trained leg press outranks recent isolated leg extension");
  const bench = result.plan.exercises.find(ex => ex.exerciseId === 1);
  assert.ok(bench && bench.setTargets.every(target => target.reps >= 6 && !(target.weightKg === 85 && target.reps === 1)));
  assert.match(result.reason, /всей истории/);
});

test("calf press mislabelled as legs never crowds out quad exercises", async () => {
  await request("/api/exercises");
  const raw = state();
  const calf = { ...raw.exercises.find(ex => ex.id === 14), id: 99, name: "Жим ногами сидя на икры", muscleGroup: "Ноги" };
  raw.exercises.push(calf);
  raw.workouts = [{ id: 120, name: null, startedAt: "2026-10-20T12:00:00Z", finishedAt: "2026-10-20T12:30:00Z" }];
  raw.sets = Array.from({ length: 4 }, (_, i) => ({
    id: 500 + i, workoutId: 120, exerciseId: 99, reps: 15, weightKg: 80,
    createdAt: "2026-10-20T12:05:00Z", rir: 2, technique: "good",
  }));
  const result = buildDailyWorkout(raw, new Date("2026-10-22T12:00:00Z"));
  const legs = result.plan.exercises.filter(ex => ex.muscleGroup === "Ноги");
  assert.ok(legs.length >= 1);
  assert.ok(legs.every(ex => ex.exerciseId !== 99), "calf movement is not a legs primary");
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

test("known exercise weights come from actual working history, not the rank or a generic 2.5 kg", async () => {
  await record(3, 20, 8); await template("Dumbbell fixture", 3);
  const p = await preview(); assert.ok(p.plan.exercises[0].setTargets[0].weightKg >= 17.5);
  assert.equal(p.plan.exercises[0].calibration, false);
});
test("a new dumbbell bench uses a conservative supported analog and keeps its first-set assessment mandatory", async () => {
  await record(1, 60, 8); await template("New dumbbell fixture", 3);
  const p = await preview(), target = p.plan.exercises[0];
  assert.equal(target.setTargets[0].weightKg, 17.5); assert.equal(target.calibration, true);
  assert.match(target.note, /коэффициент/);
  const w = await start(p);
  await assert.rejects(request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 3, weightKg: 17.5, reps: 8 }), { status: 400 });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: w.id });
  assert.equal(context.nextSetTarget.weightKg, 17.5);
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 3, weightKg: 17.5, reps: 8, rir: 4, technique: "good" });
  assert.equal((await loadPlan(w.id)).exercises[0].setTargets[1].weightKg, 20);
});
test("unknown source effort is discounted; heavy singles, failed technique and unrelated movements are not analogs", async () => {
  await record(1, 60, 8, {}); await template("New dumbbell fixture", 3);
  assert.equal((await preview()).plan.exercises[0].setTargets[0].weightKg, 12.5);
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
