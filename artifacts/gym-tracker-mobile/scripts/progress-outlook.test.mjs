import assert from "node:assert/strict";
import { beforeEach, test, mock, afterEach } from "node:test";
import { createHash } from "node:crypto";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";
const { bodyWeightForecast } = await import("../lib/bodyWeight.ts");
const { buildExerciseOutlook, buildProgressOutlook } = await import("../lib/exerciseOutlook.ts");
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { lineChartGeometry } = await import("../lib/chartGeometry.ts");
const now = new Date("2026-10-22T12:00:00Z");
beforeEach(() => { storage.clear(); mock.timers.enable({ apis: ["Date"], now: now.getTime() }); });
afterEach(() => mock.timers.reset());
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
async function seed() { await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" }); return state(); }
function session(raw, id, exerciseId, reps, weightKg, date, sets = 3, rir = 2) {
  raw.workouts.push({ id, name: null, startedAt: `${date}T09:00:00Z`, finishedAt: `${date}T10:00:00Z` });
  const exercise = raw.exercises.find(ex => ex.id === exerciseId);
  for (let i = 0; i < sets; i++) raw.sets.push({ id: raw.nextSetId++, workoutId: id, exerciseId, reps, weightKg, equipment: exercise.equipment,
    ...(exercise.loadMode === "assisted" ? { loadMode: "assisted", bodyWeightKg: raw.profile.bodyWeightKg } : {}), rir, technique: "good", createdAt: `${date}T09:0${i}:00Z` });
  raw.nextWorkoutId = Math.max(raw.nextWorkoutId, id + 1);
}
const trend = (slope = 0.05) => Array.from({ length: 22 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, kg: 75 + i * slope }));

test("body forecast needs actual dated observations, not a current profile value or workout count", async () => {
  await seed(); const saved = new Map(storage);
  const data = await request("/api/stats/outlook");
  assert.equal(data.body.status, "insufficient"); assert.deepEqual(data.body.points, []);
  assert.deepEqual(storage, saved); assert.equal(data.exercises.length, 31);
});
test("repeated profile edits on one day are one observation; sex/height edits add no observation", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 75 });
  await request("/api/profile", "PUT", { bodyWeightKg: 76 });
  await request("/api/profile", "PUT", { heightCm: 180, sex: "male" });
  assert.deepEqual(state().bodyWeightLog, [{ date: "2026-10-22", kg: 76 }]);
});
test("backdated body records can be corrected/deleted without replacing the newest profile weight or historical set snapshots", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const w = await request("/api/workouts", "POST");
  await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 7, weightKg: 0, reps: 8 });
  const original = structuredClone(state().sets);
  await request("/api/body-weight", "PUT", { date: "2026-10-01", kg: 75 });
  await request("/api/body-weight", "PUT", { date: "2026-10-01", kg: 75.2 });
  assert.equal(state().profile.bodyWeightKg, 80); assert.equal(state().bodyWeightLog.length, 2);
  await request("/api/body-weight/2026-10-01", "DELETE");
  assert.equal(state().profile.bodyWeightKg, 80); assert.deepEqual(state().sets, original);
});
test("adding a first dated weigh-in updates a legacy profile and subsequent older edits keep the newest observation", async () => {
  const raw = await seed(); raw.profile.bodyWeightKg = 80; storage.set(PROGRESS_KEY, JSON.stringify(raw));
  await request("/api/body-weight", "PUT", { date: "2026-10-01", kg: 75 });
  assert.equal(state().profile.bodyWeightKg, 75);
  await request("/api/body-weight", "PUT", { date: "2026-10-02", kg: 75.2 });
  await request("/api/body-weight/2026-10-01", "DELETE");
  assert.equal(state().profile.bodyWeightKg, 75.2, "the latest dated observation is the profile source");
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 81 });
  assert.equal(state().profile.bodyWeightKg, 81);
});
test("a future log left by a corrected device clock cannot overwrite today's measurement", async () => {
  const raw = await seed(); raw.profile.bodyWeightKg = 80; raw.bodyWeightLog = [{ date: "2026-10-01", kg: 75 }, { date: "2026-11-01", kg: 90 }];
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  await request("/api/body-weight", "PUT", { date: "2026-10-22", kg: 78 });
  assert.equal(state().profile.bodyWeightKg, 78);
  await request("/api/body-weight/2026-10-01", "DELETE");
  assert.equal(state().profile.bodyWeightKg, 78);
  assert.equal((await request("/api/stats/outlook")).body.history.length, 1);
});
test("invalid/future dates, units and nonfinite values cannot mutate progress", async () => {
  await seed(); const saved = new Map(storage);
  for (const input of [{ date: "2026-02-30", kg: 75 }, { date: "2026-10-23", kg: 75 }, { date: "2026-10-01", kg: "75" }, { date: "2026-10-01", kg: -1 }, { date: "bad", kg: 75 }]) {
    await assert.rejects(request("/api/body-weight", "PUT", input), { status: 400 });
  }
  assert.deepEqual(storage, saved);
});
test("robust body trend handles gain, loss and stable weight without calling them muscle growth", () => {
  for (const slope of [0.05, -0.05, 0]) {
    const log = trend(slope), saved = structuredClone(log), forecast = bodyWeightForecast(log, now);
    assert.equal(forecast.status, "ready"); assert.equal(forecast.points.length, 3);
    assert.equal(Math.sign(forecast.weeklyChangeKg), Math.sign(slope));
    assert.ok(forecast.points.every(row => row.low <= row.value && row.value <= row.high));
    assert.match(forecast.reason, /не прирост мышц/); assert.deepEqual(log, saved);
  }
});
test("one water-weight outlier cannot dominate a weekly-median forecast", () => {
  const log = trend(); const normal = bodyWeightForecast(log, now);
  log[10].kg += 8;
  const value = bodyWeightForecast(log, now);
  assert.equal(value.status, "ready"); assert.ok(Math.abs(value.points.at(-1).value - normal.points.at(-1).value) < 0.5);
});
test("sparse, stale and abrupt body data refuse an unsupported numerical forecast", () => {
  assert.equal(bodyWeightForecast(trend().slice(-3), now).status, "insufficient");
  assert.equal(bodyWeightForecast(trend(), new Date("2026-12-01T12:00:00Z")).status, "stale");
  assert.equal(bodyWeightForecast(trend(1), now).status, "unstable");
});
test("v11 backup includes weight history and remains compatible with v10 without inventing dated weigh-ins", async () => {
  await request("/api/body-weight", "PUT", { date: "2026-10-01", kg: 75 });
  const backup = await exportProgress(); assert.equal(JSON.parse(backup).version, 11);
  await restoreProgress(backup); assert.deepEqual(state().bodyWeightLog, [{ date: "2026-10-01", kg: 75 }]);
  const legacy = JSON.parse(backup); legacy.version = 10; delete legacy.state.bodyWeightLog;
  legacy.checksum = createHash("sha256").update(JSON.stringify({ state: legacy.state, plans: legacy.plans })).digest("hex");
  await restoreProgress(JSON.stringify(legacy)); assert.equal(state().bodyWeightLog, undefined);
  assert.deepEqual((await request("/api/stats/outlook")).body.points, []);
});
test("a checksummed backup with duplicate or impossible weight dates is rejected without overwriting progress", async () => {
  await seed(); const backup = JSON.parse(await exportProgress()), saved = new Map(storage);
  for (const rows of [[{ date: "2026-02-30", kg: 75 }], [{ date: "2026-10-01", kg: 75 }, { date: "2026-10-01", kg: 76 }]]) {
    backup.state.bodyWeightLog = rows;
    backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex");
    await assert.rejects(restoreProgress(JSON.stringify(backup)));
  }
  assert.deepEqual(storage, saved);
});
test("exercise outlook is deterministic/read-only and never logs imagined future successes or feeds them to EMA", async () => {
  const raw = await seed(); session(raw, 1, 1, 8, 70, "2026-10-20");
  const saved = structuredClone(raw), a = buildExerciseOutlook(raw, 1, now), b = buildExerciseOutlook(raw, 1, now);
  assert.deepEqual(a, b); assert.deepEqual(raw, saved); assert.equal(a.sessions.length, 6);
  assert.ok(a.sessions.every(row => row.targets.length === 3 && row.targets.every(set => set.reps <= 12 && set.weightKg <= 72.5)));
  assert.ok(a.sessions.every((row, i) => row.date >= "2026-10-22" && (!i || row.date > a.sessions[i - 1].date)));
});
test("upper-range progress needs two full sessions; a five kg quantum can fit while an oversized quantum is held", async () => {
  const raw = await seed(); session(raw, 1, 1, 12, 70, "2026-10-20");
  let value = buildExerciseOutlook(raw, 1, now);
  assert.equal(value.sessions[0].targets[0].weightKg, 70); assert.equal(value.sessions[0].targets[0].reps, 12);
  assert.equal(value.sessions[1].targets[0].weightKg, 72.5); assert.equal(value.sessions[1].targets[0].reps, 8);
  raw.exercises.find(ex => ex.id === 1).weightStepKg = 5;
  value = buildExerciseOutlook(raw, 1, now);
  assert.equal(value.sessions[1].targets[0].weightKg, 75);
  raw.exercises.find(ex => ex.id === 1).weightStepKg = 10;
  value = buildExerciseOutlook(raw, 1, now);
  assert.ok(value.sessions.every(row => row.targets.every(set => set.weightKg === 70 && set.reps <= 12)));
});
test("new/bodyweight/seconds/assistance stay in their own units with no invented muscle or extra-load gain", async () => {
  const raw = await seed();
  for (const id of [1, 7]) {
    const value = buildExerciseOutlook(raw, id, now);
    assert.equal(value.calibration, true); assert.equal(value.changeKg, null);
    assert.ok(value.sessions.every(row => row.targets.length === 1 && row.targets[0].reps <= (id === 7 ? 3 : 8)));
  }
  const timed = buildExerciseOutlook(raw, 30, now);
  assert.equal(timed.changeKg, null); assert.ok(timed.sessions.every(row => row.targets.every(set => set.reps === 0 && set.weightKg === 0 && set.durationSeconds > 0)));
});
test("month sequence determines dates and sets; active/completed slots and absent exercises are not silently scheduled again", async () => {
  const raw = await seed(); session(raw, 1, 1, 8, 70, "2026-10-20");
  const plan = { name: "Month", overview: "fixture", daysPerWeek: 3,
    templates: [2, 4].map(sets => ({ name: "Bench", description: "", exercises: [{ exerciseId: 1, reason: "fixture", targets: Array.from({ length: sets }, () => ({ weightKg: 70, reps: 20, durationSeconds: null })) }] })),
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "fixture", sessions: [0, 1, 0] })) };
  raw.coachMonth = { id: "a".repeat(64), createdAt: now.toISOString(), plan };
  raw.workouts[0].coachCycle = { planId: raw.coachMonth.id, slot: 0 };
  const value = buildExerciseOutlook(raw, 1, now);
  assert.equal(value.scheduleSource, "Месячный план");
  assert.deepEqual(value.sessions.map(row => row.targets.length), [4, 2, 2, 4, 2, 2]);
  assert.ok(value.sessions.every(row => row.targets.every(set => set.reps <= 12)));
  assert.equal(buildExerciseOutlook(raw, 21, now).sessions.length, 0);
  const first = value.sessions[0].date;
  raw.workouts.push({ id: 99, name: null, startedAt: now.toISOString(), finishedAt: null, coachCycle: { planId: raw.coachMonth.id, slot: 1 } });
  const active = buildExerciseOutlook(raw, 1, now);
  assert.equal(active.sessions[0].targets.length, 2); assert.ok(active.sessions[0].date > first);
});
test("the next planned exercise uses the same first numerical targets and set count as today's local workout", async () => {
  const raw = await seed(); session(raw, 1, 1, 8, 70, "2026-10-10");
  const daily = buildDailyWorkout(raw, now);
  for (const exercise of daily.plan.exercises) {
    const forecast = buildExerciseOutlook(raw, exercise.exerciseId, now);
    assert.equal(forecast.sessions[0].targets.length, exercise.sets);
    assert.equal(forecast.sessions[0].targets[0].weightKg, exercise.setTargets[0].weightKg);
    assert.equal(forecast.sessions[0].targets[0].reps, exercise.setTargets[0].reps);
  }
});
test("future and unfinished workouts cannot manufacture a progression or measurement", async () => {
  const raw = await seed(), before = buildExerciseOutlook(raw, 1, now);
  session(raw, 99, 1, 12, 150, "2026-11-01");
  const after = buildExerciseOutlook(raw, 1, now);
  assert.deepEqual(after, before);
  raw.workouts[0].finishedAt = null;
  assert.deepEqual(buildExerciseOutlook(raw, 1, now), before);
});
test("stale upper-range success requires recalibration and cannot create imagined working-load progression", async () => {
  const raw = await seed(); session(raw, 1, 1, 12, 70, "2026-08-01");
  const value = buildExerciseOutlook(raw, 1, now);
  assert.equal(value.calibration, true); assert.equal(value.progression, null);
  assert.ok(value.sessions.every(row => row.calibration && row.targets.length === 1 && row.targets[0].weightKg === 62.5));
});
test("assisted forecast needs body weight, keeps counterweight semantics and respects the current body-weight maximum", async () => {
  await seed();
  const ex = await request("/api/exercises", "POST", { name: "Assisted", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  let raw = state(); assert.deepEqual(buildExerciseOutlook(raw, ex.id, now).sessions, []);
  raw.profile.bodyWeightKg = 80; session(raw, 1, ex.id, 8, 70, "2026-10-20", 3, 1);
  raw.profile.bodyWeightKg = 65;
  const value = buildExerciseOutlook(raw, ex.id, now);
  assert.ok(value.sessions.every(row => row.targets.every(set => set.weightKg === 65)));
  assert.equal(value.changeKg, null);
});
test("the first timed month prescription matches its saved duration, not a generic thirty seconds", async () => {
  const raw = await seed();
  const plan = { name: "Month", overview: "fixture", daysPerWeek: 3,
    templates: [{ name: "Plank", description: "", exercises: [{ exerciseId: 30, reason: "fixture", targets: [{ weightKg: 0, reps: 0, durationSeconds: 45 }] }] }],
    weeks: Array.from({ length: 4 }, (_, i) => ({ week: i + 1, focus: "fixture", sessions: [0, 0, 0] })) };
  raw.coachMonth = { id: "a".repeat(64), createdAt: now.toISOString(), plan };
  const first = buildExerciseOutlook(raw, 30, now).sessions[0].targets[0];
  assert.deepEqual(first, { weightKg: 0, reps: 0, durationSeconds: 45 });
  assert.deepEqual(first, (({ weightKg, reps, durationSeconds }) => ({ weightKg, reps, durationSeconds }))(buildDailyWorkout(raw, now).plan.exercises[0].setTargets[0]));
});
test("all-exercise forecast shares planning work on a long history and stays read-only", async t => {
  const raw = await seed();
  for (let i = 0; i < 1200; i++) {
    const day = new Date(now.getTime() - (i + 1) * 86400000).toISOString().slice(0, 10);
    session(raw, i + 1, [1, 8, 14][i % 3], 10, 70, day, 6);
  }
  const before = JSON.stringify(raw), start = performance.now();
  const forecast = buildProgressOutlook(raw, now);
  t.diagnostic(`31 exercises / 1200 workouts / 7200 sets: ${Math.round(performance.now() - start)} ms`);
  assert.equal(forecast.exercises.length, 31); assert.equal(JSON.stringify(raw), before);
});
test("zoomed forecast charts show small changes without altering the existing zero-based charts", () => {
  const points = [{ date: "2026-10-01", value: 75 }, { date: "2026-10-22", value: 75.8 }];
  const normal = lineChartGeometry(points, 320, 160), zoomed = lineChartGeometry(points, 320, 160, false);
  assert.equal(normal.ticks[0].value, 0); assert.ok(zoomed.ticks[0].value > 74);
  assert.ok(zoomed.coordinates[0].y - zoomed.coordinates[1].y > 70);
  assert.ok(lineChartGeometry([points[0]], 320, 160, false).coordinates.every(row => Number.isFinite(row.y)));
});
