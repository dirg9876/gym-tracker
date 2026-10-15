import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { AUTO_BACKUP_JOBS_KEY } from "./progressStorage";

export const AUTOMATIC_BACKUP_KEY = "gym-tracker:auto-backup:v1";
const id = z.number().int().positive().safe();
const settingsSchema = z.object({
  enabled: z.boolean(), folderUri: z.string().nullable(), pending: z.array(id),
  lastExport: z.string().nullable(), lastError: z.string().nullable(),
});
const jobsSchema = z.array(z.object({ workoutId: id, finishedAt: z.string().datetime({ offset: true }).nullable() }))
  .refine(jobs => new Set(jobs.map(job => job.workoutId)).size === jobs.length);
export type AutomaticBackupJob = z.infer<typeof jobsSchema>[number];
export type AutomaticBackupSettings = z.infer<typeof settingsSchema>;
async function readStoredSettings(): Promise<AutomaticBackupSettings> {
  const raw = await AsyncStorage.getItem(AUTOMATIC_BACKUP_KEY);
  return raw == null ? { enabled: true, folderUri: null, pending: [], lastExport: null, lastError: null } : settingsSchema.parse(JSON.parse(raw));
}
// Unlocked helpers are shared by the API transaction and the file writer.
export async function readAutomaticBackupJobs(): Promise<AutomaticBackupJob[]> {
  const raw = await AsyncStorage.getItem(AUTO_BACKUP_JOBS_KEY);
  if (raw != null) return jobsSchema.parse(JSON.parse(raw));
  return (await readStoredSettings()).pending.map(workoutId => ({ workoutId, finishedAt: null }));
}
export async function readAutomaticBackupSettings(): Promise<AutomaticBackupSettings> {
  return { ...await readStoredSettings(), pending: (await readAutomaticBackupJobs()).map(job => job.workoutId) };
}
export const saveAutomaticBackupSettings = (settings: AutomaticBackupSettings) => AsyncStorage.setItem(AUTOMATIC_BACKUP_KEY, JSON.stringify(settings));
export const saveAutomaticBackupJobs = (jobs: AutomaticBackupJob[]) => AsyncStorage.setItem(AUTO_BACKUP_JOBS_KEY, JSON.stringify(jobsSchema.parse(jobs)));
