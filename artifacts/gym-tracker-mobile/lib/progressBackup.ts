import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { z } from "zod";
import { coachCycleAssignmentSchema, coachProfileSchema, savedCoachMonthSchema } from "@workspace/ai-coach";
import { disableAiCoach } from "./aiCoachConnection";
import { migrateExerciseCatalog } from "./exerciseReplacement";
import { clearCoachProposal } from "./aiCoachPlan";
import type { OfflineState } from "./offlineApi";
import { bodyWeightLogSchema } from "./bodyWeight";
import { isTimedExercise, minimumWeight } from "./workoutMeasurement";
import { equipmentSettingsSchema, validEquipmentSettings, isAssisted } from "./equipmentSettings";
import { templateExerciseSchema, validateTargets } from "./workoutTemplates";
import { coachFieldsSchema, timerSchema } from "./trainingCoach";
import { draftRevisionSchema, draftAssessmentSchema, draftCommitSchema, workoutDraftSchema, validDraftForExercise } from "./workoutDraft";
import {
  AUTO_BACKUP_JOBS_KEY, LAST_EXPORT_KEY, PLAN_PREFIX, PROGRESS_KEY, RECOVERY_KEY,
  readProgressEntries, quarantineProgress, readQuarantinedProgress, commitProgressTransaction, ProgressRecoveryRequired, withProgressLock,
} from "./progressStorage";

export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const id = z.number().int().positive().safe();
const amount = z.number().finite().nonnegative();
const date = z.string().datetime({ offset: true });
const equipment = z.enum(["barbell", "dumbbell", "bodyweight", "machine", "other"]);
const plannedExercise = templateExerciseSchema;

const stateSchema = z.object({
  bodyWeightLog: bodyWeightLogSchema.optional(),
  coachProfile: coachProfileSchema.optional(),
  coachMonth: savedCoachMonthSchema.optional(),
  version: z.literal(1),
  nextExerciseId: id, nextWorkoutId: id, nextSetId: id, nextProgramId: id,
  exercises: z.array(z.object({
    id, name: z.string().min(1), muscleGroup: z.string().min(1),
    isMain: z.boolean(), isCustom: z.boolean(), equipment,
    bodyweightMultiplier: amount,
    deletedAt: date.optional(),
    replacementPending: z.boolean().optional(),
  }).extend(equipmentSettingsSchema.shape).passthrough().refine(validEquipmentSettings)),
  workouts: z.array(z.object({ id, name: z.string().nullable(), startedAt: date, finishedAt: date.nullable(), timer: timerSchema.optional(), restSeconds: z.number().int().min(30).max(900).optional(), draft: workoutDraftSchema.optional(), draftRevision: draftRevisionSchema.optional(), draftAssessment: draftAssessmentSchema.extend({ revision: draftRevisionSchema }).optional(), lastDraftCommit: draftCommitSchema.optional(), coachCycle: coachCycleAssignmentSchema.optional(), trainingMode: z.literal("office").optional(), splitDay: z.enum(["push", "pull", "legs"]).optional() }).passthrough()),
  sets: z.array(z.object({
    id, workoutId: id, exerciseId: id, weightKg: amount,
    equipment: equipment.optional(),
    bodyWeightKg: z.number().finite().min(20).max(500).optional(),
    loadMode: z.enum(["weight", "assisted"]).optional(), dumbbellCount: z.union([z.literal(1), z.literal(2)]).optional(),
    reps: z.number().int().nonnegative().safe(), durationSeconds: id.max(86400).optional(), createdAt: date,
    revision: draftRevisionSchema.optional(), editedAt: date.optional(),
  }).extend(coachFieldsSchema.shape).passthrough().refine(set => set.durationSeconds != null ? set.reps === 0 && set.weightKg === 0 && set.rir == null : set.reps > 0)),
  profile: z.object({
    bodyWeightKg: z.number().finite().min(20).max(500).nullable(),
    heightCm: z.number().finite().positive().nullable(),
    sex: z.enum(["male", "female"]).optional(),
  }).passthrough(),
  customPrograms: z.array(z.object({
    id, name: z.string().min(1), description: z.string(), exercises: z.array(plannedExercise),
  }).passthrough()),
  confirmedLevel: z.number().int().min(0).max(80),
  levelUpAt: date.nullable(),
}).passthrough();

const planSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), emoji: z.string(),
  basedOnLevel: z.number().int().min(0).max(80), basedOnLevelName: z.string(),
  benchmarkKg: amount, isCustom: z.boolean(),
  exercises: z.array(plannedExercise.and(z.object({
    name: z.string(), muscleGroup: z.string(), suggestedWeightKg: amount,
    isBodyweight: z.boolean(), equipment,
    basedOn: z.enum(["personal-record", "level-benchmark"]),
  }).passthrough())),
}).passthrough();

const backupSchema = z.object({
  format: z.literal("gym-tracker-backup"),
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10), z.literal(11)]),
  exportedAt: date,
  state: stateSchema,
  plans: z.record(z.string().regex(/^[1-9]\d*$/), planSchema),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ProgressBackup = z.infer<typeof backupSchema>;

function checkRelations(backup: Pick<ProgressBackup, "state" | "plans">) {
  const { state, plans } = backup;
  const invalid = () => { throw new Error("В копии нарушены связи тренировок, подходов или программ."); };
  for (const [rows, next] of [
    [state.exercises, state.nextExerciseId], [state.workouts, state.nextWorkoutId],
    [state.sets, state.nextSetId], [state.customPrograms, state.nextProgramId],
  ] as const) {
    if (new Set(rows.map((row) => row.id)).size !== rows.length || rows.some((row) => row.id >= next)) invalid();
  }
  const exercises = new Set(state.exercises.map((row) => row.id));
  const available = new Set(state.exercises.filter(row => !row.deletedAt).map(row => row.id));
  const workouts = new Set(state.workouts.map((row) => row.id));
  if (state.coachMonth) {
    for (const plan of state.coachMonth.plan.templates) for (const row of plan.exercises) {
      const exercise = state.exercises.find(ex => ex.id === row.exerciseId);
      if (!exercise || row.targets.some(target => isTimedExercise(exercise.name)
        ? target.durationSeconds == null || target.weightKg !== 0 || target.reps !== 0
        : target.durationSeconds != null || target.reps < 1 || (target.weightKg != null && target.weightKg < minimumWeight(exercise.equipment)))) invalid();
    }
    if (state.workouts.some(workout => workout.coachCycle?.planId === state.coachMonth!.id && workout.coachCycle.slot >= state.coachMonth!.plan.daysPerWeek * 4)) invalid();
  }
  for (const workout of state.workouts) {
    if (workout.timer && (workout.finishedAt || (workout.timer.kind === "plank" && (!available.has(workout.timer.exerciseId!) || !isTimedExercise(state.exercises.find(ex => ex.id === workout.timer!.exerciseId)?.name ?? ""))))) invalid();
    if (workout.draft && (workout.finishedAt || !available.has(workout.draft.exerciseId) || !validDraftForExercise(workout.draft, state.exercises.find(ex => ex.id === workout.draft!.exerciseId)!))) invalid();
    if (workout.lastDraftCommit && (workout.finishedAt || workout.lastDraftCommit.revision >= (workout.draftRevision ?? 0) || !state.sets.some(set => set.id === workout.lastDraftCommit!.setId && set.workoutId === workout.id))) invalid();
  }
  if (state.workouts.filter((workout) => !workout.finishedAt).length > 1) invalid();
  for (const set of state.sets) {
    const exercise = state.exercises.find(ex => ex.id === set.exerciseId);
    const recordedEquipment = set.equipment ?? exercise?.equipment;
    if (!exercises.has(set.exerciseId) || !workouts.has(set.workoutId) || !Number.isFinite(set.weightKg * set.reps)) invalid();
    if (set.durationSeconds != null && !isTimedExercise(state.exercises.find(exercise => exercise.id === set.exerciseId)!.name)) invalid();
    if (set.bodyWeightKg != null && (set.durationSeconds != null || recordedEquipment !== "bodyweight" && !isAssisted(set))) invalid();
    if (set.equipment == null && isAssisted(set) !== isAssisted(exercise) || isAssisted(set) && (recordedEquipment !== "machine" || set.bodyWeightKg == null || set.weightKg > set.bodyWeightKg || set.durationSeconds != null)) invalid();
    if (set.dumbbellCount != null && (recordedEquipment !== "dumbbell" || set.durationSeconds != null)) invalid();
  }
  for (const program of state.customPrograms) {
    if (program.exercises.some((exercise) => !available.has(exercise.exerciseId))) invalid();
    if (program.exercises.some(def => !validateTargets(state.exercises.find(ex => ex.id === def.exerciseId)!, def.setTargets))) invalid();
  }
  for (const [workoutId, plan] of Object.entries(plans)) {
    if (!workouts.has(Number(workoutId)) || plan.exercises.some((exercise) => !available.has(exercise.exerciseId))) invalid();
    if (plan.exercises.some(def => !validateTargets(state.exercises.find(ex => ex.id === def.exerciseId)!, def.setTargets))) invalid();
  }
}

async function checksum(state: unknown, plans: unknown): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify({ state, plans }));
}

export function validateStoredProgress(entries: [string, string][]): OfflineState {
  const stateText = entries.find(([key]) => key === PROGRESS_KEY)?.[1];
  if (stateText == null) throw new Error("Missing stored state");
  const original = JSON.parse(stateText) as unknown;
  const state = stateSchema.parse(original);
  const plans = Object.fromEntries(entries.filter(([key]) => key.startsWith(PLAN_PREFIX)).map(([key, value]) => [key.slice(PLAN_PREFIX.length), planSchema.parse(JSON.parse(value))]));
  if (Object.keys(plans).some(key => !/^[1-9]\d*$/.test(key))) throw new Error("Invalid stored plan key");
  checkRelations({ state, plans });
  return original as OfflineState;
}

export async function parseProgressBackup(text: string): Promise<ProgressBackup> {
  if (text.length > MAX_BACKUP_BYTES) throw new Error("Файл слишком большой: максимум 25 МБ.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Файл повреждён или не является JSON-копией."); }
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) throw new Error("Неподдерживаемый формат или повреждённые данные резервной копии.");
  // Hash the original objects, before schema parsing can reorder their properties.
  const original = value as ProgressBackup;
  if (await checksum(original.state, original.plans) !== original.checksum) {
    throw new Error("Проверка целостности не пройдена. Данные не изменены.");
  }
  checkRelations(parsed.data);
  if (migrateExerciseCatalog(parsed.data.state)) parsed.data.checksum = await checksum(parsed.data.state, parsed.data.plans);
  return parsed.data;
}

async function serializeEntries(entries: [string, string][]): Promise<string> {
  const stateText = entries.find(([key]) => key === PROGRESS_KEY)?.[1];
  if (!stateText) throw new Error("Данные приложения ещё не загружены.");
  const state = validateStoredProgress(entries);
  migrateExerciseCatalog(state);
  const plans = Object.fromEntries(entries.filter(([key]) => key.startsWith(PLAN_PREFIX))
    .map(([key, value]) => [key.slice(PLAN_PREFIX.length), JSON.parse(value)]));
  const text = JSON.stringify({
    format: "gym-tracker-backup", version: 11, exportedAt: new Date().toISOString(),
    state, plans, checksum: await checksum(state, plans),
  }, null, 2);
  await parseProgressBackup(text);
  return text;
}

export function exportProgress(): Promise<string> {
  return withProgressLock(async () => {
    const entries = await readProgressEntries();
    if (!entries.length) throw new Error("Данные приложения ещё не загружены.");
    try { validateStoredProgress(entries); }
    catch { await quarantineProgress(entries, "Invalid stored progress"); throw new ProgressRecoveryRequired(); }
    return serializeEntries(entries);
  });
}

export function restoreProgress(text: string): Promise<ProgressBackup> {
  return withProgressLock(async () => {
    const backup = await parseProgressBackup(text);
    await disableAiCoach();
    clearCoachProposal();
    const previous = await readProgressEntries();
    let recovery: string | null = null;
    if (previous.length) {
      let valid = false;
      try { validateStoredProgress(previous); valid = true; }
      catch { await quarantineProgress(previous, "Progress replaced during recovery"); }
      if (valid) recovery = await serializeEntries(previous);
    }
    const entries: [string, string][] = [
      [PROGRESS_KEY, JSON.stringify(backup.state)],
      ...Object.entries(backup.plans).map(([key, plan]): [string, string] => [PLAN_PREFIX + key, JSON.stringify(plan)]),
      [AUTO_BACKUP_JOBS_KEY, "[]"],
    ];
    const nextKeys = new Set(entries.map(([key]) => key));
    const obsolete = previous.map(([key]) => key).filter((key) => !nextKeys.has(key));
    if (recovery) await AsyncStorage.setItem(RECOVERY_KEY, recovery);
    await commitProgressTransaction(entries, obsolete);
    return backup;
  }, { allowDamagedJournal: true });
}

export function getBackupStatus() {
  return withProgressLock(async () => ({
    lastExport: await AsyncStorage.getItem(LAST_EXPORT_KEY),
    recovery: await AsyncStorage.getItem(RECOVERY_KEY),
    quarantine: await readQuarantinedProgress(),
  }), { allowDamagedJournal: true });
}

export function recordSuccessfulExport(date: string) {
  return withProgressLock(() => AsyncStorage.setItem(LAST_EXPORT_KEY, date));
}
