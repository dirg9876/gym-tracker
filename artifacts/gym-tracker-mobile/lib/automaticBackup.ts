import { Directory } from "expo-file-system";
import { exportProgress, parseProgressBackup, recordSuccessfulExport } from "./progressBackup";
import { withProgressLock } from "./progressStorage";
import { readAutomaticBackupSettings, readAutomaticBackupJobs, saveAutomaticBackupJobs, saveAutomaticBackupSettings, type AutomaticBackupJob, type AutomaticBackupSettings } from "./automaticBackupState";
export type { AutomaticBackupSettings } from "./automaticBackupState";

const update = (change: (settings: AutomaticBackupSettings) => AutomaticBackupSettings) => withProgressLock(async () => {
  const settings = change(await readAutomaticBackupSettings());
  await saveAutomaticBackupSettings(settings);
  return settings;
});
export const getAutomaticBackupSettings = () => withProgressLock(readAutomaticBackupSettings);
export const setAutomaticBackupEnabled = (enabled: boolean) => update(settings => ({ ...settings, enabled }));
export async function chooseAutomaticBackupFolder() {
  const directory = await Directory.pickDirectoryAsync();
  return update(settings => ({ ...settings, enabled: true, folderUri: directory.uri, lastError: null }));
}
const sameJob = (a: AutomaticBackupJob, b: AutomaticBackupJob) => a.workoutId === b.workoutId && a.finishedAt === b.finishedAt;
async function acknowledge(jobs: AutomaticBackupJob[], folderUri: string, exportedAt?: string) {
  return withProgressLock(async () => {
    const settings = await readAutomaticBackupSettings();
    if (settings.folderUri !== folderUri) return settings;
    const remaining = (await readAutomaticBackupJobs()).filter(job => !jobs.some(done => sameJob(done, job)));
    const next = { ...settings, pending: remaining.map(job => job.workoutId), ...(exportedAt ? { lastExport: exportedAt, lastError: null } : {}) };
    if (exportedAt) await saveAutomaticBackupSettings(next);
    await saveAutomaticBackupJobs(remaining);
    return next;
  });
}
export type AutomaticBackupResult =
  | { kind: "idle" | "disabled" | "needs-folder" }
  | { kind: "saved"; filename: string }
  | { kind: "failed"; message: string };
let running: Promise<AutomaticBackupResult> | null = null;
export function runAutomaticBackup(force = false): Promise<AutomaticBackupResult> {
  if (running) return running;
  running = writeBackup(force).finally(() => { running = null; });
  return running;
}
async function writeBackup(force: boolean): Promise<AutomaticBackupResult> {
  try {
    const { settings, jobs } = await withProgressLock(async () => ({ settings: await readAutomaticBackupSettings(), jobs: await readAutomaticBackupJobs() }));
    if (!settings.enabled) return { kind: "disabled" };
    if (!settings.pending.length && !force) return { kind: "idle" };
    if (!settings.folderUri) return { kind: "needs-folder" };
    const text = await exportProgress();
    const backup = await parseProgressBackup(text);
    const completed = new Map(backup.state.workouts.filter(workout => workout.finishedAt).map(workout => [workout.id, workout.finishedAt]));
    const valid = jobs.filter(job => completed.has(job.workoutId) && (job.finishedAt == null || completed.get(job.workoutId) === job.finishedAt));
    if (!valid.length && !force) {
      const next = await acknowledge(jobs, settings.folderUri);
      if (next.enabled && next.folderUri && next.pending.length) return writeBackup(false);
      return { kind: "idle" };
    }
    const directory = new Directory(settings.folderUri);
    const filename = `gym-tracker-auto-${backup.exportedAt.replace(/[:.]/g, "-")}-${valid.at(-1)?.workoutId ?? "snapshot"}.json`;
    const file = directory.createFile(filename, "application/json");
    try {
      file.write(text);
      if ((await parseProgressBackup(await file.text())).checksum !== backup.checksum) throw new Error("Записанная копия не совпадает с исходными данными.");
    } catch (error) {
      try { file.delete(); } catch { /* A revoked folder may also forbid cleanup. */ }
      throw error;
    }
    await recordSuccessfulExport(backup.exportedAt);
    const next = await acknowledge(jobs, settings.folderUri, backup.exportedAt);
    if (next.enabled && next.folderUri && next.pending.length) return writeBackup(false);
    return { kind: "saved", filename };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось записать файл.";
    try { await update(settings => ({ ...settings, lastError: message })); } catch { /* Keep the completed workout even if settings storage is full. */ }
    return { kind: "failed", message };
  }
}
