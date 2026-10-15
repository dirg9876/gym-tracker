import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";
import { storage, request } from "./testHarness.mjs";
const files = new Map();
globalThis.__automaticBackupFiles = files;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier !== "expo-file-system") return nextResolve(specifier, context);
  return { shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(`
    class File {
      constructor(uri) { this.uri = uri; }
      write(text) {
        if (globalThis.__failBackupWrite) throw new Error('Folder unavailable');
        globalThis.__automaticBackupFiles.set(this.uri, text);
      }
      async text() {
        await globalThis.__duringBackupRead?.();
        return globalThis.__corruptBackupRead ? '{}' : globalThis.__backupReadOverride ?? globalThis.__automaticBackupFiles.get(this.uri);
      }
      delete() { globalThis.__automaticBackupFiles.delete(this.uri); }
    }
    export class Directory {
      constructor(uri) { this.uri = uri; }
      static async pickDirectoryAsync() {
        if (globalThis.__cancelBackupFolder) throw new Error('cancelled');
        return new Directory('content://test/GymTracker');
      }
      createFile(name) { return new File(this.uri + '/' + name); }
    }
  `) };
} });
const { chooseAutomaticBackupFolder, getAutomaticBackupSettings, runAutomaticBackup, setAutomaticBackupEnabled } = await import("../lib/automaticBackup.ts");
const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { PROGRESS_KEY, AUTO_BACKUP_JOBS_KEY } = await import("../lib/progressStorage.ts");
beforeEach(() => {
  storage.clear(); files.clear();
  globalThis.__failBackupWrite = false;
  globalThis.__corruptBackupRead = false;
  globalThis.__cancelBackupFolder = false;
  globalThis.__duringBackupRead = undefined;
  globalThis.__backupReadOverride = undefined;
});
const finish = async () => {
  const workout = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10 });
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  return workout;
};
test("automatic export waits for one folder choice, then writes verified full progress", async () => {
  await finish();
  assert.equal((await runAutomaticBackup()).kind, "needs-folder");
  assert.equal(files.size, 0);
  await chooseAutomaticBackupFolder();
  const result = await runAutomaticBackup();
  assert.equal(result.kind, "saved");
  const backup = await parseProgressBackup([...files.values()][0]);
  const current = await parseProgressBackup(await exportProgress());
  assert.deepEqual(backup.state, current.state);
  assert.deepEqual(backup.plans, current.plans);
  const settings = await getAutomaticBackupSettings();
  assert.deepEqual(settings.pending, []);
  assert.equal(settings.lastExport, backup.exportedAt);
  assert.equal((await runAutomaticBackup()).kind, "idle");
  assert.equal(files.size, 1);
});
test("automatic export can be disabled and directory cancellation never changes progress", async () => {
  await setAutomaticBackupEnabled(false);
  await finish();
  assert.deepEqual((await getAutomaticBackupSettings()).pending, []);
  assert.equal((await runAutomaticBackup()).kind, "disabled");
  const original = new Map(storage);
  globalThis.__cancelBackupFolder = true;
  await assert.rejects(chooseAutomaticBackupFolder());
  assert.deepEqual(storage, original);
  assert.equal(files.size, 0);
});
test("failed or corrupt exports keep the completed workout and pending retry", async () => {
  const workout = await finish();
  const original = storage.get(PROGRESS_KEY);
  await chooseAutomaticBackupFolder();
  for (const flag of ["__failBackupWrite", "__corruptBackupRead"]) {
    globalThis[flag] = true;
    assert.equal((await runAutomaticBackup()).kind, "failed");
    assert.equal(storage.get(PROGRESS_KEY), original);
    assert.deepEqual((await getAutomaticBackupSettings()).pending, [workout.id]);
    assert.ok((await getAutomaticBackupSettings()).lastError);
    assert.equal(files.size, 0);
    globalThis[flag] = false;
  }
  assert.equal((await runAutomaticBackup()).kind, "saved");
  assert.equal((await getAutomaticBackupSettings()).lastError, null);
});
test("parallel auto-export calls coalesce and persistent pending jobs survive settings reads", async () => {
  const first = await finish();
  const second = await finish();
  assert.deepEqual((await getAutomaticBackupSettings()).pending, [first.id, second.id]);
  await chooseAutomaticBackupFolder();
  const results = await Promise.all([runAutomaticBackup(), runAutomaticBackup()]);
  assert.equal(results[0].kind, "saved");
  assert.deepEqual(results[0], results[1]);
  assert.equal(files.size, 1);
  assert.equal((await parseProgressBackup([...files.values()][0])).state.workouts.length, 2);
});
test("deleted workout jobs are pruned; local folder permissions stay outside imported progress", async () => {
  const workout = await finish();
  const snapshot = await exportProgress();
  assert.ok(!snapshot.includes('content://test'));
  await chooseAutomaticBackupFolder();
  await request(`/api/workouts/${workout.id}`, "DELETE");
  assert.equal((await runAutomaticBackup()).kind, "idle");
  assert.equal(files.size, 0);
  await restoreProgress(snapshot);
  assert.equal((await getAutomaticBackupSettings()).folderUri, "content://test/GymTracker");
  assert.equal((await runAutomaticBackup(true)).kind, "saved");
});

test("a valid but different readback cannot acknowledge an automatic copy", async () => {
  await request("/api/profile");
  globalThis.__backupReadOverride = await exportProgress();
  const workout = await finish();
  await chooseAutomaticBackupFolder();
  assert.equal((await runAutomaticBackup()).kind, "failed");
  assert.deepEqual((await getAutomaticBackupSettings()).pending, [workout.id]);
  assert.equal(files.size, 0);
  globalThis.__backupReadOverride = undefined;
  assert.equal((await runAutomaticBackup()).kind, "saved");
});

test("a new finished workout during file verification is copied before the run ends", async () => {
  await finish();
  await chooseAutomaticBackupFolder();
  globalThis.__duringBackupRead = async () => {
    globalThis.__duringBackupRead = undefined;
    await finish();
  };
  assert.equal((await runAutomaticBackup()).kind, "saved");
  assert.equal(files.size, 2);
  assert.equal((await parseProgressBackup([...files.values()].at(-1))).state.workouts.length, 2);
  assert.deepEqual((await getAutomaticBackupSettings()).pending, []);
});

test("an older copy cannot acknowledge a reused workout ID after an import", async () => {
  await request("/api/profile");
  const empty = await exportProgress();
  await finish();
  const oldJob = JSON.parse(storage.get(AUTO_BACKUP_JOBS_KEY))[0];
  await chooseAutomaticBackupFolder();
  globalThis.__duringBackupRead = async () => {
    globalThis.__duringBackupRead = undefined;
    await restoreProgress(empty);
    // Imported active progress can reuse numeric IDs, but not the completed-job identity.
    await new Promise(resolve => setTimeout(resolve, 5));
    await finish();
    const newJob = JSON.parse(storage.get(AUTO_BACKUP_JOBS_KEY))[0];
    assert.equal(newJob.workoutId, oldJob.workoutId);
    assert.notEqual(newJob.finishedAt, oldJob.finishedAt);
  };
  assert.equal((await runAutomaticBackup()).kind, "saved");
  assert.equal(files.size, 2);
  const latest = await parseProgressBackup([...files.values()].at(-1));
  assert.notEqual(latest.state.workouts[0].finishedAt, oldJob.finishedAt);
  assert.deepEqual((await getAutomaticBackupSettings()).pending, []);
});
