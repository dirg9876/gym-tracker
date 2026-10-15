import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { storage, request } from "./testHarness.mjs";

const { exportProgress, restoreProgress, getBackupStatus, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { AUTOMATIC_BACKUP_KEY, readAutomaticBackupJobs } = await import("../lib/automaticBackupState.ts");
const { PROGRESS_KEY, PLAN_PREFIX, PENDING_RESTORE_KEY, AUTO_BACKUP_JOBS_KEY, QUARANTINE_PREFIX, ProgressRecoveryRequired, withProgressLock } = await import("../lib/progressStorage.ts");

beforeEach(() => {
  storage.clear();
  globalThis.__storageFault = undefined;
  globalThis.__failMultiSetOnce = false;
  globalThis.__failMultiRemoveOnce = false;
});

async function plannedWorkout() {
  const program = await request("/api/programs", "POST", {
    name: "Safety fixture", exercises: [{ exerciseId: 1, sets: 2, repsMin: 8, repsMax: 12, intent: "hypertrophy" }],
  });
  const workout = await request("/api/workouts", "POST", { programId: program.id });
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  return workout;
}

const progressSnapshot = () => new Map([...storage].filter(([key]) => key === PROGRESS_KEY || key.startsWith(PLAN_PREFIX) || key === AUTO_BACKUP_JOBS_KEY));
const failOnce = (operation, key, phase = "after") => {
  globalThis.__storageFault = event => {
    if (event.operation === operation && event.key === key && event.phase === phase) {
      globalThis.__storageFault = undefined;
      throw new Error("Injected storage failure");
    }
  };
};

test("malformed stored progress is quarantined byte-for-byte, never reset, and can be recovered", async () => {
  const workout = await plannedWorkout();
  const good = await exportProgress();
  for (const raw of ["{broken", "", "null", "{}", JSON.stringify({ ...JSON.parse(storage.get(PROGRESS_KEY)), sets: null })]) {
    storage.set(PROGRESS_KEY, raw);
    storage.set("unrelated-key", "keep me");
    await assert.rejects(request("/api/profile"), ProgressRecoveryRequired);
    await assert.rejects(request("/api/workouts", "POST", {}), ProgressRecoveryRequired);
    await assert.rejects(exportProgress(), ProgressRecoveryRequired);
    assert.equal(storage.get(PROGRESS_KEY), raw);
    assert.equal(storage.get("unrelated-key"), "keep me");
    const quarantines = [...storage.keys()].filter(key => key.startsWith(QUARANTINE_PREFIX));
    const archived = JSON.parse((await getBackupStatus()).quarantine);
    assert.equal(new Map(archived.entries).get(PROGRESS_KEY), raw);
    await request("/api/profile").catch(() => {});
    assert.equal([...storage.keys()].filter(key => key.startsWith(QUARANTINE_PREFIX)).length, quarantines.length);
    await restoreProgress(good);
    assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 1);
    assert.ok(await loadPlan(workout.id));
    assert.equal((await getBackupStatus()).quarantine, JSON.stringify(archived, null, 2));
  }
});

test("broken stored relations and plans cannot be silently dropped by normalization", async () => {
  const workout = await plannedWorkout();
  const good = await exportProgress();
  const original = JSON.parse(storage.get(PROGRESS_KEY));
  for (const change of [
    state => { state.sets[0].workoutId = 999; },
    state => { state.exercises.push(state.exercises[0]); },
    state => { state.nextSetId = 1; },
  ]) {
    const state = structuredClone(original); change(state);
    storage.set(PROGRESS_KEY, JSON.stringify(state));
    await assert.rejects(request("/api/workouts"), ProgressRecoveryRequired);
    assert.equal(storage.get(PROGRESS_KEY), JSON.stringify(state));
    await restoreProgress(good);
  }
  const planKey = PLAN_PREFIX + workout.id;
  for (const value of ["{broken", "null", "{}"] ) {
    storage.set(planKey, value);
    await assert.rejects(request("/api/workouts"), ProgressRecoveryRequired);
    assert.equal(new Map(JSON.parse((await getBackupStatus()).quarantine).entries).get(planKey), value);
    await restoreProgress(good);
  }
  storage.delete(PROGRESS_KEY);
  await assert.rejects(request("/api/profile"), ProgressRecoveryRequired);
  assert.equal(storage.has(PROGRESS_KEY), false);
  await restoreProgress(good);
});

test("invalid journals are preserved and only explicit recovery can replace them", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 82.5 });
  const good = await exportProgress();
  const original = storage.get(PROGRESS_KEY);
  for (const raw of ["", "{broken", "null", "{}", JSON.stringify([["foreign-key", "must not write"]]), JSON.stringify([[PROGRESS_KEY, original], [PROGRESS_KEY, original]])]) {
    const current = storage.get(PROGRESS_KEY);
    storage.set(PENDING_RESTORE_KEY, raw);
    await assert.rejects(request("/api/profile"), ProgressRecoveryRequired);
    assert.equal(storage.get(PROGRESS_KEY), current);
    assert.equal(storage.has("foreign-key"), false);
    const status = await getBackupStatus();
    assert.equal(new Map(JSON.parse(status.quarantine).entries).get(PENDING_RESTORE_KEY), raw);
    await restoreProgress(good);
    assert.equal(storage.has(PENDING_RESTORE_KEY), false);
    assert.equal((await request("/api/profile")).bodyWeightKg, 82.5);
  }
});

test("recovery does not swallow transient storage failures or overwrite the old state", async () => {
  await request("/api/profile");
  const good = await exportProgress();
  const before = new Map(storage);
  failOnce("getItem", PENDING_RESTORE_KEY, "before");
  await assert.rejects(restoreProgress(good), /Injected storage failure/);
  assert.deepEqual(storage, before);
  storage.set(PROGRESS_KEY, "{broken");
  const damaged = new Map(storage);
  await assert.rejects(restoreProgress("{}"));
  assert.deepEqual(storage, damaged);
  await restoreProgress(good);
});

for (const [operation, whichKey, phase] of [
  ["setItem", "journal", "before"], ["setItem", "journal", "after"],
  ["multiSet", "state", "after"], ["multiSet", "jobs", "after"],
  ["multiRemove", "plan", "after"], ["removeItem", "journal", "before"],
]) {
  test(`finish rolls back state, plan and jobs at ${operation}/${whichKey}/${phase}`, async () => {
    const workout = await plannedWorkout();
    const before = progressSnapshot();
    const key = { journal: PENDING_RESTORE_KEY, state: PROGRESS_KEY, jobs: AUTO_BACKUP_JOBS_KEY, plan: PLAN_PREFIX + workout.id }[whichKey];
    failOnce(operation, key, phase);
    await assert.rejects(request(`/api/workouts/${workout.id}/finish`, "POST"), /Injected storage failure/);
    // The next locked read also replays a journal left by interruption before try/catch.
    assert.equal((await request(`/api/workouts/${workout.id}`)).finishedAt, null);
    assert.deepEqual(progressSnapshot(), before);
    assert.equal(storage.has(PENDING_RESTORE_KEY), false);
    await request(`/api/workouts/${workout.id}/finish`, "POST");
    assert.equal(await loadPlan(workout.id), null);
    assert.equal((await withProgressLock(readAutomaticBackupJobs)).length, 1);
  });
}

test("a lost acknowledgement after commit is safely retried without duplicating a finish job", async () => {
  const workout = await plannedWorkout();
  failOnce("removeItem", PENDING_RESTORE_KEY);
  await assert.rejects(request(`/api/workouts/${workout.id}/finish`, "POST"), /Injected storage failure/);
  const completed = await request(`/api/workouts/${workout.id}`);
  assert.ok(completed.finishedAt);
  assert.equal(await loadPlan(workout.id), null);
  const jobs = await withProgressLock(readAutomaticBackupJobs);
  assert.deepEqual(jobs, [{ workoutId: workout.id, finishedAt: completed.finishedAt }]);
  const report = await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.equal(report.workout.finishedAt, completed.finishedAt);
  assert.deepEqual(await withProgressLock(readAutomaticBackupJobs), jobs);
});

test("v2 journal replays an interrupted finish after process death, keeping unrelated settings", async () => {
  const workout = await plannedWorkout();
  const before = progressSnapshot();
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  storage.set("unrelated-key", "survive");
  storage.set(AUTOMATIC_BACKUP_KEY, JSON.stringify({ enabled: true, folderUri: "content://local", pending: [], lastExport: null, lastError: null }));
  storage.set(PENDING_RESTORE_KEY, JSON.stringify({ version: 2, previous: [...before] }));
  assert.equal((await request(`/api/workouts/${workout.id}`)).finishedAt, null);
  assert.deepEqual(progressSnapshot(), before);
  assert.equal(storage.get("unrelated-key"), "survive");
  assert.equal(JSON.parse(storage.get(AUTOMATIC_BACKUP_KEY)).folderUri, "content://local");
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  assert.deepEqual((await withProgressLock(readAutomaticBackupJobs)).map(job => job.workoutId), [workout.id]);
});

test("import clears stale jobs without transferring or revoking local folder settings", async () => {
  const workout = await plannedWorkout();
  const active = await exportProgress();
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  storage.set(AUTOMATIC_BACKUP_KEY, JSON.stringify({ enabled: true, folderUri: "content://local", pending: [workout.id], lastExport: null, lastError: null }));
  await restoreProgress(active);
  assert.deepEqual(await withProgressLock(readAutomaticBackupJobs), []);
  assert.equal(JSON.parse(storage.get(AUTOMATIC_BACKUP_KEY)).folderUri, "content://local");
  assert.deepEqual((await parseProgressBackup(await exportProgress())).state, (await parseProgressBackup(active)).state);
});

test("legacy pending IDs remain readable until the next atomic finish migrates them", async () => {
  const first = await plannedWorkout();
  await request(`/api/workouts/${first.id}/finish`, "POST");
  storage.delete(AUTO_BACKUP_JOBS_KEY);
  storage.set(AUTOMATIC_BACKUP_KEY, JSON.stringify({ enabled: true, folderUri: null, pending: [first.id], lastExport: null, lastError: null }));
  assert.deepEqual(await withProgressLock(readAutomaticBackupJobs), [{ workoutId: first.id, finishedAt: null }]);
  const second = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${second.id}/finish`, "POST");
  const jobs = await withProgressLock(readAutomaticBackupJobs);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], { workoutId: first.id, finishedAt: null });
  assert.ok(jobs[1].finishedAt);
});

test("the verified-string cache never hides later corruption, added plans or unsaved mutations", async () => {
  const workout = await plannedWorkout();
  await request(`/api/workouts/${workout.id}`);
  const before = storage.get(PROGRESS_KEY);
  failOnce("setItem", PROGRESS_KEY, "before");
  await assert.rejects(request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 30, reps: 10 }), /Injected/);
  assert.equal((await request(`/api/workouts/${workout.id}`)).sets.length, 1);
  assert.equal(storage.get(PROGRESS_KEY), before);
  storage.set(PLAN_PREFIX + "999", storage.get(PLAN_PREFIX + workout.id));
  await assert.rejects(request(`/api/workouts/${workout.id}`), ProgressRecoveryRequired);
  storage.delete(PLAN_PREFIX + "999");
  storage.set(PROGRESS_KEY, before.replace('"nextSetId":2', '"nextSetId":1'));
  await assert.rejects(request(`/api/workouts/${workout.id}`), ProgressRecoveryRequired);
});

test("the newest quarantine stays newest within one millisecond and after clock rollback", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 14) });
  try {
    for (const [index, raw] of ["{first", "{second", "{third"].entries()) {
      if (index === 2) context.mock.timers.setTime(Date.UTC(2025, 0, 1));
      storage.set(PROGRESS_KEY, raw);
      await assert.rejects(request("/api/profile"), ProgressRecoveryRequired);
      const status = await getBackupStatus();
      assert.equal(new Map(JSON.parse(status.quarantine).entries).get(PROGRESS_KEY), raw);
    }
    assert.equal([...storage.keys()].filter(key => key.startsWith(QUARANTINE_PREFIX)).length, 3);
  } finally { context.mock.timers.reset(); }
});
