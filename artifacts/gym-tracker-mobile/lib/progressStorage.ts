import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

export const PROGRESS_KEY = "gym-tracker:offline-api:v1";
export const PLAN_PREFIX = "gym-tracker:program-plan:";
export const RECOVERY_KEY = "gym-tracker:backup:previous";
export const PENDING_RESTORE_KEY = "gym-tracker:backup:pending";
export const LAST_EXPORT_KEY = "gym-tracker:backup:last-export";
export const AUTO_BACKUP_JOBS_KEY = "gym-tracker:auto-backup:pending:v2";
export const QUARANTINE_PREFIX = "gym-tracker:quarantine:";

export class ProgressRecoveryRequired extends Error {
  readonly status = 503;
  constructor() {
    super("Данные требуют восстановления. Откройте раздел резервной копии.");
    this.name = "ProgressRecoveryRequired";
  }
}

let queue: Promise<unknown> = Promise.resolve();

export const isProgressKey = (key: string) => key === PROGRESS_KEY || key.startsWith(PLAN_PREFIX);
const isTransactionKey = (key: string) => isProgressKey(key) || key === AUTO_BACKUP_JOBS_KEY;
const entrySchema = z.tuple([z.string().refine(isTransactionKey), z.string()]);
const entriesSchema = z.array(entrySchema).refine(entries => new Set(entries.map(([key]) => key)).size === entries.length);
const journalSchema = z.union([
  entriesSchema.refine(entries => entries.every(([key]) => isProgressKey(key))),
  z.object({ version: z.literal(2), previous: entriesSchema }),
]);

export async function readProgressEntries(): Promise<[string, string][]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isProgressKey);
  const entries = await AsyncStorage.multiGet(keys);
  return entries.filter((entry): entry is [string, string] => entry[1] !== null);
}

async function readTransactionEntries(): Promise<[string, string][]> {
  const entries = await AsyncStorage.multiGet((await AsyncStorage.getAllKeys()).filter(isTransactionKey));
  return entries.filter((entry): entry is [string, string] => entry[1] !== null);
}

export async function readQuarantinedProgress(): Promise<string | null> {
  const key = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(QUARANTINE_PREFIX)).sort().at(-1);
  return key ? AsyncStorage.getItem(key) : null;
}

export async function quarantineProgress(entries: [string, string][], reason: string): Promise<void> {
  const ordered = entries.slice().sort(([a], [b]) => a.localeCompare(b));
  const previous = await readQuarantinedProgress();
  let previousTime = 0;
  if (previous) {
    try {
      const parsed = JSON.parse(previous);
      if (JSON.stringify(parsed.entries) === JSON.stringify(ordered)) return;
      previousTime = Date.parse(parsed.detectedAt) || 0;
    } catch { /* Preserve an unreadable older quarantine too. */ }
  }
  // Keep archive ordering stable even within one millisecond or after clock rollback.
  const detectedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
  const key = QUARANTINE_PREFIX + detectedAt + ":" + Math.random().toString(36).slice(2);
  await AsyncStorage.setItem(key, JSON.stringify({ format: "gym-tracker-damaged-data", version: 1, detectedAt, reason, entries: ordered }, null, 2));
}

export async function recoverInterruptedRestore(): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_RESTORE_KEY);
  if (raw === null) return;
  let journal: z.infer<typeof journalSchema>;
  try { journal = journalSchema.parse(JSON.parse(raw)); }
  catch {
    await quarantineProgress([...await readTransactionEntries(), [PENDING_RESTORE_KEY, raw]], "Invalid recovery journal");
    throw new ProgressRecoveryRequired();
  }
  const previous = Array.isArray(journal) ? journal : journal.previous;
  const inScope = Array.isArray(journal) ? isProgressKey : isTransactionKey;
  const keys = new Set(previous.map(([key]) => key));
  const obsolete = (await AsyncStorage.getAllKeys()).filter((key) => inScope(key) && !keys.has(key));
  await AsyncStorage.multiSet(previous);
  if (obsolete.length) await AsyncStorage.multiRemove(obsolete);
  await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
}

// Call only while holding the progress lock; journal also covers durable copy jobs.
export async function commitProgressTransaction(entries: [string, string][], removed: string[] = []): Promise<void> {
  if (entries.some(([key]) => !isTransactionKey(key)) || removed.some(key => !isTransactionKey(key))) throw new Error("Invalid transaction scope");
  await AsyncStorage.setItem(PENDING_RESTORE_KEY, JSON.stringify({ version: 2, previous: await readTransactionEntries() }));
  try {
    await AsyncStorage.multiSet(entries);
    if (removed.length) await AsyncStorage.multiRemove(removed);
    await AsyncStorage.removeItem(PENDING_RESTORE_KEY);
  } catch (error) {
    await recoverInterruptedRestore();
    throw error;
  }
}

// One lock also covers active program plans and backup/restore transactions.
export function withProgressLock<T>(operation: () => Promise<T>, options?: { allowDamagedJournal?: boolean }): Promise<T> {
  const result = queue.then(async () => {
    try { await recoverInterruptedRestore(); }
    catch (error) { if (!(options?.allowDamagedJournal && error instanceof ProgressRecoveryRequired)) throw error; }
    return operation();
  });
  queue = result.catch(() => undefined);
  return result;
}
