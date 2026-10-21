import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { coachContextSchema, coachMessagesSchema, coachProfileSchema, coachTaskSchema, defaultCoachProfile, personalCoachProfile, validateCoachReply, type CoachContext, type CoachProfile, type SavedCoachMonth } from "@workspace/ai-coach";
import { buildCoachContext } from "./aiCoachContext";
import { monthProgress } from "./coachMonth";
import { canReplaceExercise, migrateExerciseCatalog, requiresExerciseReplacement } from "./exerciseReplacement";
import { buildTrainingInsights } from "./trainingInsights";
import { getLevelLabels } from "@workspace/level-data";
import { liftForExercise, msmcTarget, rankNorms, rankForGameLevel, weightClass } from "@workspace/level-data/strength";
import { achievedExerciseLevel, levelFromExercises, targetForExerciseLevel, type ExerciseLevelsResponse, type LevelExerciseStat } from "./levelProgress";
import { durationOf, isTimedExercise, minimumWeight, sameLoadCategory, setVolume, type DurationMetrics, type MeasuredSet } from "./workoutMeasurement";
import { equipmentSettingsSchema, validEquipmentSettings, isAssisted, performanceWeight, type EquipmentSettings } from "./equipmentSettings";
import { AUTO_BACKUP_JOBS_KEY, PLAN_PREFIX, PROGRESS_KEY, isProgressKey, readProgressEntries, commitProgressTransaction, quarantineProgress, ProgressRecoveryRequired, withProgressLock } from "./progressStorage";
import { validateStoredProgress } from "./progressBackup";
import { readAutomaticBackupJobs, readAutomaticBackupSettings } from "./automaticBackupState";
import { calibrateRemaining, completedTargets, plannedSet, templateInputSchema, validateTargets, type SetTarget, type TemplateExercise, type TemplatePlan } from "./workoutTemplates";
import { draftRevisionSchema, workoutDraftSchema, validDraftForExercise, makeWorkoutDraft, selectWorkoutDraft, sameTimer, type DraftResponse, type WorkoutDraft } from "./workoutDraft";
import { exerciseStandard, standardProgress, type RankedExercise } from "./exerciseStandards";
import { coachFieldsSchema, timerSchema, remainingMs, weeklyWork, type CoachFields, type TrainingTimer, type Progression } from "./trainingCoach";
import type {
  ActiveWorkoutResponse,
  AddSetInput,
  ClaimLevelResult,
  CreateCustomProgramInput,
  CreateExerciseInput,
  CreateWorkoutInput,
  CustomFetchHandler,
  Equipment,
  Exercise,
  ExerciseLastSets,
  ExerciseProgress,
  ExerciseRankNorms,
  HeatmapResponse,
  Level,
  LevelForecast,
  LevelsResponse,
  PlannedExercise,
  Profile,
  ProgramPlan,
  ProgramSummary,
  ProgramsListResponse,
  ProgressSeries,
  SportRank,
  StatsOverview,
  UpdateCustomProgramInput,
  UpdateExerciseInput,
  UpdateProfileInput,
  Workout,
  WorkoutComparison,
  WorkoutExerciseBreakdownItem,
  WorkoutExerciseBreakdownResponse,
  WorkoutReport,
  WorkoutSet,
  WorkoutSummary,
} from "@workspace/api-client-react";

type ExerciseRow = Exercise & EquipmentSettings & {
  bodyweightMultiplier: number;
  replacementPending?: boolean;
  // Legacy input only; migration removes tombstones before serving requests.
  deletedAt?: string;
};

type WorkoutRow = {
  id: number;
  name: string | null;
  startedAt: string;
  finishedAt: string | null;
  timer?: TrainingTimer;
  restSeconds?: number;
  draft?: WorkoutDraft;
  draftRevision?: number;
  lastDraftCommit?: { revision: number; setId: number };
  coachCycle?: { planId: string; slot: number };
  trainingMode?: "office";
};

type SetRow = CoachFields & {
  equipment?: Equipment;
  bodyWeightKg?: number;
  loadMode?: "weight" | "assisted";
  dumbbellCount?: 1 | 2;
  id: number;
  workoutId: number;
  exerciseId: number;
  weightKg: number;
  reps: number;
  durationSeconds?: number;
  createdAt: string;
};

type CustomProgramRow = {
  id: number;
  name: string;
  description: string;
  exercises: CustomProgramExerciseRow[];
};

type CustomProgramExerciseRow = Progression & {
  exerciseId: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  intent: "strength" | "hypertrophy" | "accessory";
  note?: string | null;
  setTargets?: SetTarget[];
};

export type OfflineState = {
  coachProfile?: CoachProfile;
  coachMonth?: SavedCoachMonth;
  version: 1;
  nextExerciseId: number;
  nextWorkoutId: number;
  nextSetId: number;
  nextProgramId: number;
  exercises: ExerciseRow[];
  workouts: WorkoutRow[];
  sets: SetRow[];
  profile: Profile;
  customPrograms: CustomProgramRow[];
  confirmedLevel: number;
  levelUpAt: string | null;
};

type RequestBody = Record<string, unknown>;

const STORAGE_KEY = PROGRESS_KEY;
const FALLBACK_BODY_WEIGHT_KG = 75;
const LEVEL_FACTOR_ANCHOR = 80;
const BAR_WEIGHT_KG = 20;
// Cache exact verified strings, never mutable state objects. External writes invalidate it.
let verifiedProgress: Map<string, string> | null = null;

const DEFAULT_EXERCISES: ExerciseRow[] = [
  ex(1, "Жим штанги лёжа", "Грудь", true, "barbell", 1),
  ex(2, "Жим штанги на наклонной скамье", "Грудь", true, "barbell", 0.85),
  ex(3, "Жим гантелей лёжа", "Грудь", true, "dumbbell", 0.4),
  ex(4, "Отжимания на брусьях", "Грудь", true, "bodyweight", 1.3),
  ex(5, "Разводка гантелей", "Грудь", false, "dumbbell", 0.25),
  ex(6, "Становая тяга", "Спина", true, "barbell", 2),
  ex(7, "Подтягивания", "Спина", true, "bodyweight", 1.65),
  ex(8, "Тяга штанги в наклоне", "Спина", true, "barbell", 0.85),
  ex(9, "Тяга гантели одной рукой", "Спина", false, "dumbbell", 0.45),
  ex(10, "Тяга верхнего блока", "Спина", false, "machine", 0.75),
  ex(11, "Тяга горизонтального блока", "Спина", false, "machine", 0.75),
  ex(12, "Приседания со штангой", "Ноги", true, "barbell", 1.5),
  ex(13, "Румынская тяга", "Ноги", true, "barbell", 1.1),
  ex(14, "Жим ногами", "Ноги", true, "machine", 2),
  ex(15, "Выпады с гантелями", "Ноги", false, "dumbbell", 0.3),
  ex(16, "Сгибания ног лёжа", "Ноги", false, "machine", 0.5),
  ex(17, "Разгибания ног сидя", "Ноги", false, "machine", 0.6),
  ex(18, "Подъёмы на носки", "Икры", false, "machine", 1),
  ex(19, "Жим штанги стоя", "Плечи", true, "barbell", 0.65),
  ex(20, "Жим гантелей сидя", "Плечи", true, "dumbbell", 0.4),
  ex(21, "Махи гантелями в стороны", "Плечи", false, "dumbbell", 0.12),
  ex(22, "Махи в наклоне", "Плечи", false, "dumbbell", 0.1),
  ex(23, "Подъём штанги на бицепс", "Бицепс", false, "barbell", 0.4),
  ex(24, "Сгибания с гантелями", "Бицепс", false, "dumbbell", 0.18),
  ex(25, "Молотки с гантелями", "Бицепс", false, "dumbbell", 0.18),
  ex(26, "Французский жим", "Трицепс", false, "barbell", 0.4),
  ex(27, "Разгибания на блоке", "Трицепс", false, "machine", 0.4),
  ex(28, "Отжимания узким хватом", "Трицепс", false, "bodyweight", 1),
  ex(29, "Скручивания", "Пресс", false, "bodyweight", 0),
  ex(30, "Планка", "Пресс", false, "bodyweight", 0),
  ex(31, "Подъём ног в висе", "Пресс", false, "bodyweight", 0),
];

const PROGRAMS = [
  program("chest", "День груди", "Жимовая тренировка с акцентом на грудные.", "💪", [
    pex("Жим штанги лёжа", 4, 5, 6, "strength", "Главное упражнение — жми тяжело и чисто."),
    pex("Жим штанги на наклонной скамье", 4, 8, 10, "hypertrophy"),
    pex("Жим гантелей лёжа", 3, 10, 12, "hypertrophy"),
    pex("Отжимания на брусьях", 3, 8, 12, "hypertrophy", "С весом, если можешь."),
    pex("Разводка гантелей", 3, 12, 15, "accessory"),
  ]),
  program("back", "День спины", "Тяги во всех плоскостях и сильный хват.", "🦾", [
    pex("Становая тяга", 4, 5, 5, "strength", "Спина прямая, штанга у голени."),
    pex("Подтягивания", 4, 6, 10, "hypertrophy"),
    pex("Тяга штанги в наклоне", 3, 8, 10, "hypertrophy"),
    pex("Тяга гантели одной рукой", 3, 10, 12, "hypertrophy"),
    pex("Тяга верхнего блока", 3, 10, 12, "accessory"),
  ]),
  program("legs", "День ног", "Квадрицепс, бицепс бедра и икры.", "🦵", [
    pex("Приседания со штангой", 4, 5, 6, "strength"),
    pex("Румынская тяга", 4, 8, 10, "hypertrophy"),
    pex("Жим ногами", 3, 10, 12, "hypertrophy"),
    pex("Выпады с гантелями", 3, 10, 12, "accessory"),
    pex("Сгибания ног лёжа", 3, 12, 15, "accessory"),
    pex("Подъёмы на носки", 4, 12, 15, "accessory"),
  ]),
  program("shoulders", "День плеч", "Жимы и махи для широких плеч.", "⚡", [
    pex("Жим штанги стоя", 4, 5, 6, "strength"),
    pex("Жим гантелей сидя", 4, 8, 10, "hypertrophy"),
    pex("Махи гантелями в стороны", 4, 12, 15, "accessory"),
    pex("Махи в наклоне", 3, 12, 15, "accessory"),
    pex("Жим штанги на наклонной скамье", 3, 8, 10, "hypertrophy"),
  ]),
  program("arms", "День рук", "Бицепс и трицепс без лишней философии.", "🔥", [
    pex("Подъём штанги на бицепс", 4, 6, 8, "strength"),
    pex("Французский жим", 4, 6, 8, "strength"),
    pex("Сгибания с гантелями", 3, 10, 12, "hypertrophy"),
    pex("Разгибания на блоке", 3, 10, 12, "hypertrophy"),
    pex("Молотки с гантелями", 3, 12, 15, "accessory"),
    pex("Отжимания узким хватом", 3, 8, 12, "accessory"),
  ]),
  program("push", "Push: грудь + плечи + трицепс", "Все жимовые группы за одну тренировку.", "🚀", [
    pex("Жим штанги лёжа", 4, 5, 6, "strength"),
    pex("Жим штанги стоя", 4, 6, 8, "hypertrophy"),
    pex("Жим штанги на наклонной скамье", 3, 8, 10, "hypertrophy"),
    pex("Махи гантелями в стороны", 3, 12, 15, "accessory"),
    pex("Французский жим", 3, 8, 10, "hypertrophy"),
    pex("Разгибания на блоке", 3, 10, 12, "accessory"),
  ]),
  program("pull", "Pull: спина + бицепс", "Тяги и сгибания, задняя линия тела.", "🧲", [
    pex("Становая тяга", 4, 5, 5, "strength"),
    pex("Подтягивания", 4, 6, 10, "hypertrophy"),
    pex("Тяга штанги в наклоне", 3, 8, 10, "hypertrophy"),
    pex("Тяга гантели одной рукой", 3, 10, 12, "hypertrophy"),
    pex("Подъём штанги на бицепс", 3, 8, 10, "hypertrophy"),
    pex("Молотки с гантелями", 3, 12, 15, "accessory"),
  ]),
  program("fullbody", "Всё тело", "Большие группы мышц за одну тренировку.", "🏋️", [
    pex("Приседания со штангой", 4, 5, 6, "strength"),
    pex("Жим штанги лёжа", 4, 5, 6, "strength"),
    pex("Тяга штанги в наклоне", 3, 8, 10, "hypertrophy"),
    pex("Жим штанги стоя", 3, 8, 10, "hypertrophy"),
    pex("Подъём штанги на бицепс", 3, 10, 12, "accessory"),
    pex("Скручивания", 3, 15, 20, "accessory"),
  ]),
] as const;

const INTENT_FACTOR = {
  strength: 0.8,
  hypertrophy: 0.7,
  accessory: 0.6,
} as const;

function ex(
  id: number,
  name: string,
  muscleGroup: string,
  isMain: boolean,
  equipment: Equipment,
  bodyweightMultiplier: number,
): ExerciseRow {
  return {
    id,
    name,
    muscleGroup,
    isCustom: false,
    isMain,
    equipment,
    bodyweightMultiplier,
    mcKg: null,
    userMaxKg: null,
    userRank: null,
  };
}

function pex(
  name: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  intent: "strength" | "hypertrophy" | "accessory",
  note: string | null = null,
) {
  return { name, sets, repsMin, repsMax, intent, note };
}

function program(
  id: string,
  name: string,
  description: string,
  emoji: string,
  exercises: ReturnType<typeof pex>[],
) {
  return { id, name, description, emoji, exercises };
}

export const offlineApiFetch: CustomFetchHandler = (request) =>
  withProgressLock(async () => handleOfflineRequest(request));

const handleOfflineRequest: CustomFetchHandler = async ({ url, method, options }) => {
  const parsedUrl = new URL(url, "https://offline.local");
  const path = parsedUrl.pathname;
  const body = parseJsonBody(options.body);
  const state = await loadState();

  if (method === "GET" && path === "/api/healthz") return { status: "ok" };
  if (method === "GET" && path === "/api/ai-coach/profile") return personalCoachProfile(state.coachProfile ?? defaultCoachProfile());
  if (method === "PUT" && path === "/api/ai-coach/profile") {
    const parsed = coachProfileSchema.safeParse(body);
    if (!parsed.success) throw httpError(400, "Проверьте параметры тренера.");
    state.coachProfile = personalCoachProfile(parsed.data);
    await saveState(state);
    return state.coachProfile;
  }
  if (method === "POST" && path === "/api/ai-coach/context") {
    return currentCoachContext(state, body);
  }
  if (method === "POST" && path === "/api/ai-coach/apply-plan") return applyCoachPlan(state, body);
  if (method === "GET" && path === "/api/ai-coach/month") return monthProgress(state);
  if (method === "DELETE" && path === "/api/ai-coach/month") {
    delete state.coachMonth;
    await saveState(state);
    return null;
  }
  if (method === "PUT" && path === "/api/ai-coach/month") {
    const expected = coachContextSchema.parse(body.context);
    if (expected.task !== "month_plan") throw httpError(400, "Неверный месячный план.");
    const current = await currentCoachContext(state, { task: expected.task, messages: expected.messages });
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(current));
    if (fingerprint !== body.fingerprint || JSON.stringify(expected) !== JSON.stringify(current)) throw httpError(409, "История или цели изменились. Запросите новый месячный план.");
    const reply = validateCoachReply({ summary: "Monthly plan", cautions: [], plan: null, nextSet: null, monthly: body.monthly }, current);
    if (!reply.monthly) throw httpError(400, "Нет месячного плана для сохранения.");
    state.coachMonth = { id: fingerprint, createdAt: new Date().toISOString(), plan: reply.monthly };
    await saveState(state);
    return monthProgress(state);
  }
  if (method === "GET" && path === "/api/exercises") return listExercises(state);
  if (method === "POST" && path === "/api/exercises") return createExercise(state, body);
  if (method === "GET" && path === "/api/exercises/maintenance") return state.exercises.map(exercise => ({ exercise: { ...enrichExercise(state, exercise), replacementPending: !!exercise.replacementPending }, recordedSets: state.sets.filter(set => set.exerciseId === exercise.id).length, requiresReplacement: requiresExerciseReplacement(state, exercise.id) }));

  const replacement = /^\/api\/exercises\/(\d+)\/replace$/.exec(path);
  if (replacement && method === "POST") return replaceExercise(state, Number(replacement[1]), body);

  let match = /^\/api\/exercises\/(\d+)$/.exec(path);
  if (match && method === "PATCH") return updateExercise(state, Number(match[1]), body);
  if (match && method === "DELETE") return deleteExercise(state, Number(match[1]));

  match = /^\/api\/exercises\/(\d+)\/norms$/.exec(path);
  if (match && method === "GET") return getExerciseNorms(state, Number(match[1]));

  match = /^\/api\/exercises\/(\d+)\/last-sets$/.exec(path);
  if (match && method === "GET") return getExerciseLastSets(state, Number(match[1]));

  if (method === "GET" && path === "/api/workouts") {
    const limitRaw = parsedUrl.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 50;
    return listWorkouts(state, Number.isFinite(limit) ? limit : 50);
  }
  if (method === "POST" && path === "/api/workouts") return createWorkout(state, body);
  if (method === "GET" && path === "/api/workouts/active") return getActiveWorkout(state);

  match = /^\/api\/workouts\/(\d+)\/draft(?:\/(commit|transfer))?$/.exec(path);
  if (match) {
    const workout = state.workouts.find(row => row.id === Number(match![1]));
    if (!workout) throw httpError(404, "Тренировка не найдена");
    if (method === "GET" && !match[2]) return draftResponse(workout);
    if (workout.finishedAt) throw httpError(409, "Тренировка уже завершена");
    if (method === "PUT" && body.coachFingerprint != null) {
      const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(buildCoachContext(state, "next_set", workout.id)));
      if (body.coachFingerprint !== fingerprint) throw httpError(409, "Контекст изменился. Запросите новый совет.");
    }
    if (!draftRevisionSchema.safeParse(body.revision).success) throw httpError(400, "Неверная версия черновика");
    if (method === "POST" && match[2] === "commit" && workout.lastDraftCommit?.revision === body.revision) {
      const set = state.sets.find(set => set.id === workout.lastDraftCommit!.setId);
      if (set) return { set: enrichSet(state, set), ...draftResponse(workout) };
    }
    if (method === "POST" && match[2] === "transfer") {
      const expected = timerSchema.safeParse(body.timer);
      if (!expected.success || expected.data.kind !== "plank") throw httpError(400, "Нет таймера удержания для переноса");
      if (!workout.timer && workout.draft?.sourceTimer && sameTimer(workout.draft.sourceTimer, expected.data)) return { timer: null, restSeconds: workout.restSeconds ?? 120, ...draftResponse(workout) };
      requireDraftRevision(workout, body.revision);
      if (!workout.timer || !sameTimer(workout.timer, expected.data)) throw httpError(409, "Таймер изменился. Повторите перенос.");
      const elapsed = Math.floor((workout.timer.totalMs - remainingMs(workout.timer)) / 1000);
      if (elapsed < 1) throw httpError(400, "Удержание должно длиться хотя бы секунду");
      const exercise = findExercise(state, workout.timer.exerciseId!)!;
      workout.draft = { ...makeWorkoutDraft(exercise, { weightKg: 0, reps: 0, durationSeconds: elapsed }, workout.draft?.exerciseId === exercise.id ? workout.draft : state.sets.slice().reverse().find(set => set.workoutId === workout.id && set.exerciseId === exercise.id)), sourceTimer: workout.timer };
      workout.draftRevision = (workout.draftRevision ?? 0) + 1;
      delete workout.timer;
      await saveState(state);
      return { timer: null, restSeconds: workout.restSeconds ?? 120, ...draftResponse(workout) };
    }
    if (method === "PUT" && !match[2]) {
      requireDraftRevision(workout, body.revision);
      const draft = workoutDraftSchema.safeParse(body.draft);
      const exercise = draft.success ? findExercise(state, draft.data.exerciseId) : null;
      if (!draft.success || !exercise || !validDraftForExercise(draft.data, exercise)) throw httpError(400, "Проверьте упражнение и значения черновика");
      workout.draft = draft.data;
      workout.draftRevision = (workout.draftRevision ?? 0) + 1;
      await saveState(state);
      return draftResponse(workout);
    }
    if (method === "POST" && match[2] === "commit") {
      requireDraftRevision(workout, body.revision);
      if (!workout.draft) throw httpError(400, "Сначала выберите упражнение");
      const set = await addSet(state, workout.id, workout.draft, body.revision as number);
      return { set, ...draftResponse(workout) };
    }
  }

  match = /^\/api\/workouts\/(\d+)\/timer$/.exec(path);
  if (match) {
    const workout = state.workouts.find(row => row.id === Number(match![1]));
    if (!workout) throw httpError(404, "Тренировка не найдена");
    const timerResponse = () => ({ timer: workout.timer ?? null, restSeconds: workout.restSeconds ?? 120 });
    if (method === "GET") return timerResponse();
    if (workout.finishedAt) throw httpError(409, "Тренировка уже завершена");
    if (method === "DELETE") { delete workout.timer; await saveState(state); return timerResponse(); }
    if (method === "POST") {
      if (typeof body.restSeconds !== "number" || !Number.isInteger(body.restSeconds) || body.restSeconds < 30 || body.restSeconds > 900) throw httpError(400, "Отдых должен быть от30 до900 секунд");
      workout.restSeconds = body.restSeconds;
      await saveState(state);
      return timerResponse();
    }
    if (method === "PUT") {
      const timer = timerSchema.safeParse(body);
      const exercise = timer.success && timer.data.kind === "plank" ? findExercise(state, timer.data.exerciseId!) : null;
      if (!timer.success || (timer.data.kind === "plank" && (!exercise || exercise.deletedAt || !isTimedExercise(exercise.name)))) throw httpError(400, "Неверные параметры таймера");
      workout.timer = timer.data;
      await saveState(state);
      return timerResponse();
    }
  }
  match = /^\/api\/exercises\/(\d+)\/working-load$/.exec(path);
  if (match && method === "GET") return { sets: getFinishedSets(state).filter(set => set.exerciseId === Number(match![1]) && sameLoadCategory(set, findExercise(state, set.exerciseId)!)) };

  match = /^\/api\/workouts\/(\d+)$/.exec(path);
  if (match && method === "GET") return getWorkoutOrThrow(state, Number(match[1]));
  if (match && method === "DELETE") return deleteWorkout(state, Number(match[1]));

  match = /^\/api\/workouts\/(\d+)\/sets$/.exec(path);
  if (match && method === "POST") return addSet(state, Number(match[1]), body);

  match = /^\/api\/sets\/(\d+)$/.exec(path);
  if (match && method === "DELETE") return deleteSet(state, Number(match[1]));

  match = /^\/api\/workouts\/(\d+)\/finish$/.exec(path);
  if (match && method === "POST") return finishWorkout(state, Number(match[1]));

  match = /^\/api\/workouts\/(\d+)\/comparison$/.exec(path);
  if (match && method === "GET") return getWorkoutComparison(state, Number(match[1]));

  match = /^\/api\/workouts\/(\d+)\/exercise-breakdown$/.exec(path);
  if (match && method === "GET") return getWorkoutExerciseBreakdown(state, Number(match[1]));

  if (method === "GET" && path === "/api/stats/overview") return getStatsOverview(state);
  if (method === "GET" && path === "/api/stats/insights") {
    const days = parsedUrl.searchParams.get("days") ?? "28";
    if (!["28", "84", "all"].includes(days)) throw httpError(400, "Неверный период статистики");
    return buildTrainingInsights(state.workouts, getFinishedSets(state), state.exercises, days === "all" ? null : days === "84" ? 84 : 28);
  }
  if (method === "GET" && path === "/api/stats/weekly") {
    const sets = getFinishedSets(state);
    return { groups: weeklyWork(sets), exercises: weeklyWork(sets.map(set => ({ ...set, muscleGroup: String(set.exerciseId) }))).map(row => ({ ...row, exerciseId: Number(row.muscleGroup), name: findExercise(state, Number(row.muscleGroup))?.name ?? "Упражнение" })) };
  }
  if (method === "GET" && path === "/api/stats/progress") return getProgress(state);

  match = /^\/api\/stats\/exercises\/(\d+)\/progress$/.exec(path);
  if (match && method === "GET") return getExerciseProgress(state, Number(match[1]));

  if (method === "GET" && path === "/api/stats/heatmap") {
    const daysRaw = parsedUrl.searchParams.get("days");
    const days = daysRaw ? Number(daysRaw) : 365;
    return getHeatmap(state, Number.isFinite(days) ? days : 365);
  }
  if (method === "GET" && path === "/api/stats/forecast") return getLevelForecast(state);
  if (method === "GET" && path === "/api/levels") return getLevels(state);

  match = /^\/api\/levels\/claim\/(\d+)$/.exec(path);
  if (match && method === "POST") return claimLevel(state, Number(match[1]));

  if (method === "GET" && path === "/api/profile") return normalizeProfile(state.profile);
  if (method === "PUT" && path === "/api/profile") return updateProfile(state, body);

  if (method === "GET" && path === "/api/programs") return listPrograms(state);
  if (method === "POST" && path === "/api/programs") return createCustomProgram(state, body);

  match = /^\/api\/programs\/([^/]+)$/.exec(path);
  if (match && method === "GET") return getProgramPlan(state, decodeURIComponent(match[1]));
  if (match && method === "PUT") return updateCustomProgram(state, decodeURIComponent(match[1]), body);
  if (match && method === "DELETE") return deleteCustomProgram(state, decodeURIComponent(match[1]));

  throw httpError(404, `Offline API route not found: ${method} ${path}`);
};

function parseJsonBody(body: BodyInit | null | undefined): RequestBody {
  if (typeof body !== "string" || body.trim() === "") return {};
  const parsed = JSON.parse(body) as unknown;
  return parsed && typeof parsed === "object" ? (parsed as RequestBody) : {};
}

async function loadState(): Promise<OfflineState> {
  const entries = await readProgressEntries();
  if (!entries.length) {
    const fresh = createInitialState();
    await saveState(fresh);
    return fresh;
  }
  let normalized: OfflineState;
  try {
    const unchanged = verifiedProgress?.size === entries.length && entries.every(([key, value]) => verifiedProgress!.get(key) === value);
    const state = unchanged ? JSON.parse(verifiedProgress!.get(STORAGE_KEY)!) as OfflineState : validateStoredProgress(entries);
    normalized = normalizeState(state);
    verifiedProgress = new Map(entries);
  } catch {
    await quarantineProgress(entries, "Invalid stored progress");
    throw new ProgressRecoveryRequired();
  }
  if (migrateExerciseCatalog(normalized)) await saveStateAndPlans(normalized);
  return normalized;
}

async function saveState(state: OfflineState): Promise<void> {
  const text = JSON.stringify(state);
  await AsyncStorage.setItem(STORAGE_KEY, text);
  if (!verifiedProgress) verifiedProgress = new Map();
  verifiedProgress.set(STORAGE_KEY, text);
}

function createInitialState(): OfflineState {
  return {
    version: 1,
    nextExerciseId: DEFAULT_EXERCISES.length + 1,
    nextWorkoutId: 1,
    nextSetId: 1,
    nextProgramId: 1,
    exercises: DEFAULT_EXERCISES.map((item) => ({ ...item })),
    workouts: [],
    sets: [],
    profile: { bodyWeightKg: null, heightCm: null, bmi: null, bmiCategory: null, sex: "male" },
    customPrograms: [],
    confirmedLevel: 0,
    levelUpAt: null,
  };
}

function normalizeState(input: Partial<OfflineState>): OfflineState {
  const fallback = createInitialState();
  return {
    ...(input.coachProfile ? { coachProfile: input.coachProfile } : {}),
    ...(input.coachMonth ? { coachMonth: input.coachMonth } : {}),
    version: 1,
    nextExerciseId: input.nextExerciseId ?? fallback.nextExerciseId,
    nextWorkoutId: input.nextWorkoutId ?? fallback.nextWorkoutId,
    nextSetId: input.nextSetId ?? fallback.nextSetId,
    nextProgramId: input.nextProgramId ?? fallback.nextProgramId,
    exercises: Array.isArray(input.exercises) ? input.exercises : fallback.exercises,
    workouts: Array.isArray(input.workouts) ? input.workouts : [],
    sets: Array.isArray(input.sets) ? input.sets : [],
    profile: normalizeProfile(input.profile ?? fallback.profile),
    customPrograms: Array.isArray(input.customPrograms) ? input.customPrograms : [],
    confirmedLevel: typeof input.confirmedLevel === "number" ? input.confirmedLevel : fallback.confirmedLevel,
    levelUpAt: typeof input.levelUpAt === "string" ? input.levelUpAt : null,
  };
}

function normalizeProfile(profile: Profile): Profile {
  const bodyWeightKg = profile.bodyWeightKg ?? null;
  const heightCm = profile.heightCm ?? null;
  const bmi =
    bodyWeightKg && heightCm ? round(bodyWeightKg / Math.pow(heightCm / 100, 2), 1) : null;
  return {
    bodyWeightKg,
    heightCm,
    bmi,
    bmiCategory: bmi == null ? null : bmi < 18.5 ? "underweight" : bmi < 25 ? "normal" : bmi < 30 ? "overweight" : "obese",
    sex: profile.sex ?? "male",
  };
}

function findExercise(state: OfflineState, exerciseId: number): ExerciseRow | null {
  return state.exercises.find((item) => item.id === exerciseId) ?? null;
}

function listExercises(state: OfflineState): Exercise[] {
  return state.exercises
    .filter(item => !item.deletedAt)
    .map((item) => enrichExercise(state, item))
    .sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup) || a.name.localeCompare(b.name));
}

async function createExercise(state: OfflineState, body: RequestBody): Promise<Exercise> {
  const row = newExercise(state, body);
  state.exercises.push(row);
  await saveState(state);
  return enrichExercise(state, row);
}

function newExercise(state: OfflineState, body: RequestBody): ExerciseRow {
  const name = String(body.name ?? "").trim();
  const muscleGroup = String(body.muscleGroup ?? "").trim();
  if (!name || !muscleGroup) throw httpError(400, "Заполни название и группу мышц");
  if (name.length > 120 || muscleGroup.length > 60) throw httpError(400, "Название: до 120 символов, группа мышц: до 60.");
  if (body.equipment !== undefined && !isEquipment(body.equipment)) throw httpError(400, "Неизвестная категория упражнения.");
  const settings = equipmentSettingsSchema.safeParse(body);
  if (!settings.success) throw httpError(400, "Проверьте шаг веса и настройки оборудования.");

  const row: ExerciseRow = {
    id: state.nextExerciseId++,
    name,
    muscleGroup,
    isCustom: true,
    isMain: false,
    equipment: isEquipment(body.equipment) ? body.equipment : "other",
    bodyweightMultiplier: 1,
    mcKg: null,
    userMaxKg: null,
    userRank: null,
    ...settings.data,
  };
  if (!validEquipmentSettings(row)) throw httpError(400, "Противовес доступен только для тренажёров, число гантелей — только для гантелей.");
  return row;
}

async function updateExercise(
  state: OfflineState,
  exerciseId: number,
  body: RequestBody,
): Promise<Exercise> {
  const row = findExercise(state, exerciseId);
  if (!row || row.deletedAt) throw httpError(404, "Упражнение не найдено");
  const next = { ...row };
  const settings = equipmentSettingsSchema.safeParse(body);
  if (!settings.success) throw httpError(400, "Проверьте шаг веса и настройки оборудования.");
  Object.assign(next, settings.data);
  if (body.name !== undefined || body.muscleGroup !== undefined) {
    if (!row.isCustom) throw httpError(409, "Названия встроенных упражнений закреплены за нормативами.");
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) throw httpError(400, "Укажите название до 120 символов.");
      next.name = body.name.trim();
    }
    if (body.muscleGroup !== undefined) {
      if (typeof body.muscleGroup !== "string" || !body.muscleGroup.trim() || body.muscleGroup.trim().length > 60) throw httpError(400, "Укажите группу мышц до 60 символов.");
      next.muscleGroup = body.muscleGroup.trim();
    }
  }
  if (body.equipment !== undefined) {
    if (!isEquipment(body.equipment)) throw httpError(400, "Неизвестный тип оборудования.");
    next.equipment = body.equipment;
    if (next.equipment !== "dumbbell") delete next.dumbbellCount;
    if (next.equipment !== "machine" && body.loadMode == null) next.loadMode = "weight";
  }
  if (!validEquipmentSettings(next)) throw httpError(400, "Проверьте совместимость категории и настройки нагрузки.");
  const categoryChanged = next.equipment !== row.equipment;
  if (isTimedExercise(next.name) !== isTimedExercise(row.name) || !categoryChanged && isAssisted(next) !== isAssisted(row)) {
    const plans = (await readProgressEntries()).filter(([key]) => key.startsWith(PLAN_PREFIX));
    const used = state.sets.some(set => set.exerciseId === exerciseId)
      || state.workouts.some(workout => workout.timer?.exerciseId === exerciseId || workout.draft?.exerciseId === exerciseId)
      || state.customPrograms.some(program => program.exercises.some(ex => ex.exerciseId === exerciseId))
      || state.coachMonth?.plan.templates.some(plan => plan.exercises.some(ex => ex.exerciseId === exerciseId))
      || plans.some(([, value]) => (JSON.parse(value) as ProgramPlan).exercises.some(ex => ex.exerciseId === exerciseId));
    if (used) throw httpError(409, "Упражнение уже используется. Для перехода между временем и повторами или смены режима противовеса создайте новое упражнение.");
  }
  if (typeof body.isMain === "boolean") next.isMain = body.isMain;
  const changed: [string, string][] = [];
  if (categoryChanged) {
    for (const set of state.sets.filter(set => set.exerciseId === exerciseId && set.equipment == null)) {
      set.equipment = row.equipment;
      set.loadMode ??= row.loadMode ?? "weight";
      if (row.equipment === "dumbbell" && set.durationSeconds == null) set.dumbbellCount ??= 1;
    }
    // Old numeric loads are not transferable between categories. Recalibrate future targets.
    const initialWeight = isTimedExercise(next.name) || next.equipment === "bodyweight" || isAssisted(next) ? 0 : Math.max(minimumWeight(next.equipment), next.equipment === "machine" ? 5 : 2.5);
    const resetTargets = (targets: SetTarget[]) => targets.map(set => set.durationSeconds != null ? set : { weightKg: initialWeight, reps: Math.min(set.reps, next.equipment === "bodyweight" ? 3 : 8), setType: "working" as const });
    const resetPlan = (items: Array<CustomProgramExerciseRow & { calibration?: boolean; suggestedWeightKg?: number; equipment?: Equipment; isBodyweight?: boolean }>) => {
      for (const item of items.filter(item => item.exerciseId === exerciseId)) {
        if (item.setTargets) item.setTargets = resetTargets(item.setTargets);
        item.calibration = !isTimedExercise(next.name);
        item.note = "Категория изменена. Начните с калибровочного подхода и оцените запас и технику.";
        if (item.equipment != null) item.equipment = next.equipment;
        if (item.isBodyweight != null) item.isBodyweight = next.equipment === "bodyweight";
        if (item.suggestedWeightKg != null) item.suggestedWeightKg = initialWeight;
      }
    };
    for (const program of state.customPrograms) resetPlan(program.exercises);
    for (const [key, value] of (await readProgressEntries()).filter(([key]) => key.startsWith(PLAN_PREFIX))) {
      const plan = JSON.parse(value) as TemplatePlan;
      if (!plan.exercises.some(ex => ex.exerciseId === exerciseId)) continue;
      resetPlan(plan.exercises);
      changed.push([key, JSON.stringify(plan)]);
    }
    if (state.coachMonth) for (const plan of state.coachMonth.plan.templates) {
      for (const item of plan.exercises.filter(item => item.exerciseId === exerciseId)) {
        for (const target of item.targets) if (target.durationSeconds == null) {
          target.weightKg = initialWeight;
          target.reps = Math.min(target.reps, next.equipment === "bodyweight" ? 3 : 8);
        }
      }
    }
    for (const workout of state.workouts.filter(workout => !workout.finishedAt && workout.draft?.exerciseId === exerciseId)) {
      if (!isTimedExercise(next.name)) workout.draft = makeWorkoutDraft(next, { weightKg: initialWeight, reps: Math.min(workout.draft!.reps, next.equipment === "bodyweight" ? 3 : 8) });
    }
  }
  if (categoryChanged || (next.weightStepKg ?? 2.5) !== (row.weightStepKg ?? 2.5) || (next.dumbbellCount ?? 1) !== (row.dumbbellCount ?? 1)) {
    for (const workout of state.workouts.filter(workout => !workout.finishedAt && workout.draft?.exerciseId === exerciseId)) {
      if ((workout.draftRevision ?? 0) >= Number.MAX_SAFE_INTEGER) throw httpError(409, "Слишком много изменений черновика.");
      workout.draftRevision = (workout.draftRevision ?? 0) + 1;
    }
  }
  Object.assign(row, next);
  if (next.equipment !== "dumbbell") delete row.dumbbellCount;
  await saveStateAndPlans(state, changed);
  return enrichExercise(state, row);
}

async function deleteExercise(state: OfflineState, exerciseId: number): Promise<void> {
  const row = findExercise(state, exerciseId);
  if (!row) {
    if (exerciseId < state.nextExerciseId) return;
    throw httpError(404, "Упражнение не найдено");
  }
  if (requiresExerciseReplacement(state, exerciseId)) throw httpError(409, "Выберите замену: у упражнения есть подходы или месячный план. История не будет удалена.");
  state.exercises = state.exercises.filter(exercise => exercise.id !== exerciseId);
  for (const workout of state.workouts) {
    if (workout.timer?.exerciseId === exerciseId) delete workout.timer;
    if (workout.draft?.exerciseId === exerciseId) { delete workout.draft; workout.draftRevision = (workout.draftRevision ?? 0) + 1; }
  }
  for (const program of state.customPrograms) {
    program.exercises = program.exercises.filter(ex => ex.exerciseId !== exerciseId);
  }
  const plans = (await readProgressEntries()).filter(([key]) => key.startsWith(PLAN_PREFIX));
  const changed: [string, string][] = [];
  for (const [key, value] of plans) {
    const plan = JSON.parse(value) as ProgramPlan;
    if (plan.exercises.some(ex => ex.exerciseId === exerciseId)) {
      plan.exercises = plan.exercises.filter(ex => ex.exerciseId !== exerciseId);
      changed.push([key, JSON.stringify(plan)]);
    }
  }
  await saveStateAndPlans(state, changed);
}

async function replaceExercise(state: OfflineState, exerciseId: number, body: RequestBody): Promise<Exercise> {
  const source = findExercise(state, exerciseId);
  if (!source) throw httpError(404, "Упражнение уже заменено или удалено. Обновите список.");
  if ((body.targetExerciseId != null) === (body.exercise != null)) throw httpError(400, "Выберите существующее или создайте новое упражнение.");
  const target = body.exercise && typeof body.exercise === "object" && !Array.isArray(body.exercise)
    ? newExercise(state, body.exercise as RequestBody)
    : typeof body.targetExerciseId === "number" ? findExercise(state, body.targetExerciseId) : null;
  if (!target || !canReplaceExercise(source, target)) throw httpError(400, "Для переноса нужны одинаковые категория, единицы, противовес и число гантелей.");
  if (body.exercise) state.exercises.push(target);

  const remap = <T extends CustomProgramExerciseRow>(rows: T[]): T[] => {
    const mapped = rows.map(row => row.exerciseId !== exerciseId ? { ...row } : { ...row, exerciseId: target.id,
      ...("name" in row ? { name: target.name, muscleGroup: target.muscleGroup, equipment: target.equipment, isBodyweight: target.equipment === "bodyweight" } : {}) });
    const result: T[] = [];
    for (const row of mapped) {
      const existing = result.find(item => item.exerciseId === row.exerciseId);
      if (!existing) { result.push(row); continue; }
      if (!!existing.setTargets !== !!row.setTargets) throw httpError(409, "В виде тренировки совпали упражнения с точными весами и без них. Укажите веса обоим или создайте отдельное упражнение.");
      existing.sets += row.sets;
      existing.repsMin = Math.min(existing.repsMin, row.repsMin);
      existing.repsMax = Math.max(existing.repsMax, row.repsMax);
      if (existing.setTargets && row.setTargets) existing.setTargets = [...existing.setTargets, ...row.setTargets];
    }
    return result;
  };
  for (const program of state.customPrograms) program.exercises = remap(program.exercises);
  const changed: [string, string][] = [];
  for (const [key, value] of (await readProgressEntries()).filter(([key]) => key.startsWith(PLAN_PREFIX))) {
    const plan = JSON.parse(value) as TemplatePlan;
    if (!plan.exercises.some(ex => ex.exerciseId === exerciseId)) continue;
    plan.exercises = remap(plan.exercises.map(ex => ({ ...ex, setTargets: ex.setTargets ?? Array.from({ length: ex.sets }, (_, i) => plannedSet(ex, i)) })));
    changed.push([key, JSON.stringify(plan)]);
  }
  if (state.coachMonth) for (const plan of state.coachMonth.plan.templates) {
    if (!plan.exercises.some(exercise => exercise.exerciseId === exerciseId)) continue;
    const merged = new Map<number, typeof plan.exercises[number]>();
    for (const exercise of plan.exercises) {
      const id = exercise.exerciseId === exerciseId ? target.id : exercise.exerciseId;
      const existing = merged.get(id);
      if (existing) {
        if (existing.targets.length + exercise.targets.length > 6) throw httpError(409, "После объединения в месячном плане будет больше 6 подходов на упражнение. Создайте отдельную замену или измените месячный план.");
        existing.targets = [...existing.targets, ...exercise.targets];
      } else merged.set(id, { ...exercise, exerciseId: id });
    }
    plan.exercises = [...merged.values()];
  }
  for (const set of state.sets) if (set.exerciseId === exerciseId) set.exerciseId = target.id;
  for (const workout of state.workouts) {
    if (workout.timer?.exerciseId === exerciseId) workout.timer.exerciseId = target.id;
    if (!workout.finishedAt && (workout.draft?.exerciseId === exerciseId || workout.draft?.exerciseId === target.id)) {
      if ((workout.draftRevision ?? 0) >= Number.MAX_SAFE_INTEGER) throw httpError(409, "Слишком много изменений черновика.");
      workout.draftRevision = (workout.draftRevision ?? 0) + 1;
      if (workout.draft?.exerciseId === exerciseId) {
        workout.draft.exerciseId = target.id;
        if (workout.draft.sourceTimer) workout.draft.sourceTimer.exerciseId = target.id;
      }
    }
  }
  if (state.coachProfile) state.coachProfile.excludedExerciseIds = [...new Set(state.coachProfile.excludedExerciseIds.map(id => id === exerciseId ? target.id : id))];
  state.exercises = state.exercises.filter(exercise => exercise.id !== exerciseId);
  delete target.replacementPending;
  await saveStateAndPlans(state, changed);
  return enrichExercise(state, target);
}

async function saveStateAndPlans(state: OfflineState, plans: [string, string][] = [], removed: string[] = []): Promise<void> {
  const entries: [string, string][] = [[STORAGE_KEY, JSON.stringify(state)], ...plans];
  await commitProgressTransaction(entries, removed);
  if (verifiedProgress) {
    for (const [key, value] of entries) if (isProgressKey(key)) verifiedProgress.set(key, value);
    for (const key of removed) verifiedProgress.delete(key);
  }
}

function enrichExercise(state: OfflineState, row: ExerciseRow): RankedExercise {
  const mc = getMcKg(state, row);
  const sets = getFinishedSets(state).filter((set) => set.exerciseId === row.id && sameLoadCategory(set, row));
  const userMaxKg = sets
    .reduce<number | null>((best, set) => (best == null || performanceWeight(set) > best ? performanceWeight(set) : best), null);
  const standard = exerciseStandard(row, state.profile);
  const rankBest = sets.reduce((best, set) => Math.max(best, standard.unit === "kg" ? performanceWeight(set) : standard.unit === "seconds" ? durationOf(set) : set.reps), 0);
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
    isCustom: row.isCustom,
    isMain: row.isMain,
    equipment: row.equipment,
    ...(row.weightStepKg != null ? { weightStepKg: row.weightStepKg } : {}),
    ...(row.loadMode != null ? { loadMode: row.loadMode } : {}),
    ...(row.dumbbellCount != null ? { dumbbellCount: row.dumbbellCount } : {}),
    mcKg: mc.kg,
    userMaxKg,
    userRank: standardProgress(standard, rankBest).current?.rank ?? null,
    standard,
    rankBest,
  };
}

function getExerciseNorms(state: OfflineState, exerciseId: number): ExerciseRankNorms & Pick<RankedExercise, "standard" | "rankBest"> {
  const row = findExercise(state, exerciseId);
  if (!row) throw httpError(404, "Упражнение не найдено");
  const { standard, rankBest } = enrichExercise(state, row);
  const mc = getMcKg(state, row);
  const userMaxWeightKg = getFinishedSets(state)
    .filter((set) => set.exerciseId === exerciseId && sameLoadCategory(set, row))
    .reduce<number | null>((best, set) => (best == null || performanceWeight(set) > best ? performanceWeight(set) : best), null);

  if (mc.kg == null) {
    return {
      standard, rankBest,
      mcKg: null,
      mcSource: mc.source,
      userMaxWeightKg,
      currentRank: null,
      nextRank: null,
      kgToNextRank: null,
      rankNorms: [],
      isBodyweight: row.equipment === "bodyweight",
      repNorms: null,
      userMaxRepsAtBodyweight: null,
      userMaxExtraWeightAt30Reps: null,
    };
  }

  const norms = rankNorms(liftForExercise(row.name)!, state.profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG, state.profile.sex ?? "male");
  const currentRank = norms.reduce((rank, entry) => (userMaxWeightKg ?? 0) >= entry.kgTarget ? entry.rank : rank, norms[0].rank);
  const currentIndex = currentRank
    ? norms.findIndex((item) => item.rank.code === currentRank.code)
    : -1;
  const next = norms[currentIndex + 1] ?? null;
  return {
    standard, rankBest,
    mcKg: mc.kg,
    mcSource: mc.source,
    userMaxWeightKg,
    currentRank,
    nextRank: next?.rank ?? null,
    kgToNextRank: next && userMaxWeightKg != null ? Math.max(0, next.kgTarget - userMaxWeightKg) : next?.kgTarget ?? null,
    rankNorms: norms,
    isBodyweight: row.equipment === "bodyweight",
    repNorms: null,
    userMaxRepsAtBodyweight: null,
    userMaxExtraWeightAt30Reps: null,
  };
}

function getExerciseLastSets(state: OfflineState, exerciseId: number): ExerciseLastSets {
  const sets = getFinishedSets(state)
    .filter((set) => set.exerciseId === exerciseId && sameLoadCategory(set, findExercise(state, exerciseId)!))
    .sort((a, b) => new Date(b.workoutStartedAt).getTime() - new Date(a.workoutStartedAt).getTime() || b.workoutId - a.workoutId);

  if (sets.length === 0) {
    return {
      exerciseId,
      workoutId: null,
      workoutName: null,
      workoutDate: null,
      sets: [],
      bestEverWeightKg: null,
      bestEverReps: null,
    };
  }

  const best = sets.reduce((top, set) =>
    performanceWeight(set) > performanceWeight(top) || (performanceWeight(set) === performanceWeight(top) && set.reps > top.reps) ? set : top,
  );
  const lastWorkoutId = sets[0].workoutId;
  return {
    exerciseId,
    workoutId: lastWorkoutId,
    workoutName: sets[0].workoutName,
    workoutDate: sets[0].workoutStartedAt,
    sets: sets
      .filter((set) => set.workoutId === lastWorkoutId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id)
      .map((set) => ({ ...set, durationSeconds: durationOf(set) })),
    bestEverWeightKg: performanceWeight(best),
    bestEverReps: best.reps,
  };
}

function listWorkouts(state: OfflineState, limit: number): WorkoutSummary[] {
  return state.workouts
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit)
    .map((workout) => summarizeWorkout(state, workout));
}

async function createWorkout(state: OfflineState, body: RequestBody): Promise<Workout> {
  const active = state.workouts.find((item) => item.finishedAt == null);
  if (active) return workoutResponse(state, active);
  const plan = body.programId != null ? await getProgramPlan(state, String(body.programId)) : null;
  const workout: WorkoutRow = {
    id: state.nextWorkoutId++,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  state.workouts.push(workout);
  if (plan) {
    await saveStateAndPlans(state, [[PLAN_PREFIX + workout.id, JSON.stringify(plan)]]);
  } else await saveState(state);
  return workoutResponse(state, workout);
}

async function currentCoachContext(state: OfflineState, body: RequestBody): Promise<CoachContext> {
  const task = coachTaskSchema.safeParse(body.task);
  const messages = coachMessagesSchema.optional().safeParse(body.messages);
  if (!task.success || !messages.success) throw httpError(400, "Проверьте сообщение тренеру (до 300 символов).");
  if (body.trainingMode != null && body.trainingMode !== "regular" && body.trainingMode !== "office") throw httpError(400, "Неизвестный сценарий тренировки.");
  const workoutId = typeof body.workoutId === "number" ? body.workoutId : undefined;
  const raw = task.data === "adjust_workout" && workoutId ? await AsyncStorage.getItem(PLAN_PREFIX + workoutId) : null;
  return buildCoachContext(state, task.data, workoutId, messages.data, raw ? JSON.parse(raw) as TemplatePlan : null, body.trainingMode as "regular" | "office" | undefined);
}

async function applyCoachPlan(state: OfflineState, body: RequestBody): Promise<Workout> {
  const expected = coachContextSchema.safeParse(body.context);
  if (!expected.success || !["next_workout", "adjust_workout"].includes(expected.data.task)) throw httpError(400, "Неверный план тренера.");
  const context = expected.data;
  const current = await currentCoachContext(state, { task: context.task, workoutId: context.focus?.workoutId, messages: context.messages, trainingMode: context.trainingMode });
  const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(current));
  const expectedFingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(context));
  if (fingerprint !== body.fingerprint || expectedFingerprint !== fingerprint) throw httpError(409, "Тренировка или профиль изменились. Запросите новый план.");
  const input = parseCustomProgram(state, body.plan as RequestBody);
  if (input.exercises.length > 8 || input.exercises.some(ex => !context.catalog.some(item => item.id === ex.exerciseId) || !context.preferences.equipment.includes(findExercise(state, ex.exerciseId)!.equipment) || context.preferences.excludedExerciseIds.includes(ex.exerciseId))) throw httpError(400, "План не соответствует выбранному оборудованию или исключениям.");
  const active = state.workouts.find(w => !w.finishedAt);
  const adjusting = context.task === "adjust_workout";
  if (adjusting ? !active || active.id !== context.focus?.workoutId : !!active) throw httpError(409, "Текущая тренировка изменилась. Откройте её с Главной.");
  const workout: WorkoutRow = active ?? { id: state.nextWorkoutId++, name: input.name, startedAt: new Date().toISOString(), finishedAt: null };
  if (!active && context.trainingMode === "office") workout.trainingMode = "office";
  const performed = state.sets.filter(set => set.workoutId === workout.id);
  if (!active && context.scheduled) workout.coachCycle = { planId: context.scheduled.planId, slot: context.scheduled.slot };
  if (context.trainingMode === "office" && (input.exercises.some(ex => findExercise(state, ex.exerciseId)!.equipment !== "bodyweight" || ex.sets > 3 || ex.setTargets?.some(target => target.weightKg !== 0)) || input.exercises.reduce((sum, ex) => sum + ex.sets, 0) > 9)) throw httpError(400, "Офисная тренировка: только собственный вес и до 9 подходов.");
  // Targets in an adjustment describe remaining work. Preserve completed targets
  // so existing completion counting never treats them as newly prescribed sets.
  const rows = new Map<number, TemplateExercise>();
  const makeRow = (exerciseId: number, targets: SetTarget[], note?: string | null): TemplateExercise => {
    const exercise = findExercise(state, exerciseId)!;
    const values = targets.map(set => set.durationSeconds ?? set.reps);
    return { exerciseId, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, isBodyweight: exercise.equipment === "bodyweight", basedOn: "personal-record", suggestedWeightKg: targets[0].weightKg, sets: targets.length, repsMin: Math.min(...values), repsMax: Math.max(...values), intent: "hypertrophy", note: note ?? null, setTargets: targets, weightStepKg: exercise.weightStepKg ?? 2.5, targetRir: 2 };
  };
  for (const set of performed) {
    if (!findExercise(state, set.exerciseId) || findExercise(state, set.exerciseId)!.deletedAt) continue;
    const target: SetTarget = { weightKg: set.weightKg, reps: set.reps, ...(set.durationSeconds ? { durationSeconds: set.durationSeconds } : {}), setType: "working" };
    if (!validateTargets(findExercise(state, set.exerciseId)!, [target])) throw httpError(409, "В старых подходах есть несовместимые единицы или не указано время. Изменение плана не применено; записи сохранены.");
    const targets = [...(rows.get(set.exerciseId)?.setTargets ?? []), target];
    rows.set(set.exerciseId, makeRow(set.exerciseId, targets));
  }
  for (const ex of input.exercises) {
    const targets = ex.setTargets;
    if (!targets?.length || targets.length > 6) throw httpError(400, "Укажите от 1 до 6 оставшихся подходов на упражнение.");
    rows.set(ex.exerciseId, makeRow(ex.exerciseId, [...(rows.get(ex.exerciseId)?.setTargets ?? []), ...targets], ex.note));
    const row = rows.get(ex.exerciseId)!;
    row.intent = context.preferences.goal === "strength" ? "strength" : "hypertrophy";
    row.calibration = !isTimedExercise(row.name) && !state.sets.some(set => set.exerciseId === row.exerciseId);
  }
  if (performed.length + input.exercises.reduce((sum, ex) => sum + ex.sets, 0) > Math.floor(context.preferences.sessionMinutes / 2)) throw httpError(400, "Слишком много подходов для выбранной длительности.");
  const first = input.exercises[0];
  workout.draft = makeWorkoutDraft(findExercise(state, first.exerciseId)!, first.setTargets![0], workout.draft?.exerciseId === first.exerciseId ? workout.draft : performed.slice().reverse().find(set => set.exerciseId === first.exerciseId));
  workout.draftRevision = (workout.draftRevision ?? 0) + 1;
  if (!active) state.workouts.push(workout);
  const pendingIds = new Set(input.exercises.map(ex => ex.exerciseId));
  const ordered = [...input.exercises.map(ex => rows.get(ex.exerciseId)!), ...[...rows.values()].filter(ex => !pendingIds.has(ex.exerciseId))];
  const plan: TemplatePlan = { id: "ai-session", name: input.name, description: input.description ?? "", emoji: "", basedOnLevel: 0, basedOnLevelName: "", benchmarkKg: 0, isCustom: true, exercises: ordered };
  await saveStateAndPlans(state, [[PLAN_PREFIX + workout.id, JSON.stringify(plan)]]);
  return workoutResponse(state, workout);
}

function getActiveWorkout(state: OfflineState): ActiveWorkoutResponse {
  const active = state.workouts
    .filter((item) => item.finishedAt == null)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  return { workout: active ? workoutResponse(state, active) : null };
}

function getWorkoutOrThrow(state: OfflineState, workoutId: number): Workout {
  const workout = state.workouts.find((item) => item.id === workoutId);
  if (!workout) throw httpError(404, "Тренировка не найдена");
  return workoutResponse(state, workout);
}

async function deleteWorkout(state: OfflineState, workoutId: number): Promise<void> {
  const existing = state.workouts.some((item) => item.id === workoutId);
  if (!existing) throw httpError(404, "Тренировка не найдена");
  state.workouts = state.workouts.filter((item) => item.id !== workoutId);
  state.sets = state.sets.filter((item) => item.workoutId !== workoutId);
  const jobs = (await readAutomaticBackupJobs()).filter(job => job.workoutId !== workoutId);
  await saveStateAndPlans(state, [[AUTO_BACKUP_JOBS_KEY, JSON.stringify(jobs)]], [PLAN_PREFIX + workoutId]);
}

function draftResponse(workout: WorkoutRow): DraftResponse {
  return { draft: workout.draft ?? null, revision: workout.draftRevision ?? 0 };
}

function requireDraftRevision(workout: WorkoutRow, revision: unknown) {
  if (!draftRevisionSchema.safeParse(revision).success) throw httpError(400, "Неверная версия черновика");
  if (revision !== (workout.draftRevision ?? 0) || revision === Number.MAX_SAFE_INTEGER) throw httpError(409, "Черновик изменился. Загрузите сохранённый вариант.");
}

async function addSet(state: OfflineState, workoutId: number, body: RequestBody, commitRevision?: number): Promise<WorkoutSet> {
  const workout = state.workouts.find((item) => item.id === workoutId);
  if (!workout) throw httpError(404, "Тренировка не найдена");
  if (workout.finishedAt != null) throw httpError(409, "Тренировка уже завершена");
  const coach = coachFieldsSchema.safeParse(body);
  if (!coach.success) throw httpError(400, "Проверьте тип подхода, технику и запас повторений (0-5)");
  const data = body as unknown as AddSetInput & DurationMetrics & CoachFields;
  const exercise = findExercise(state, Number(data.exerciseId));
  if (!exercise || exercise.deletedAt) throw httpError(404, "Упражнение удалено из каталога");
  if (typeof data.weightKg !== "number" || !Number.isFinite(data.weightKg) || data.weightKg < 0) {
    throw httpError(400, "Вес должен быть неотрицательным числом");
  }
  const timed = isTimedExercise(exercise.name);
  if (isAssisted(exercise) && (state.profile.bodyWeightKg == null || data.weightKg > state.profile.bodyWeightKg)) throw httpError(400, "Для противовеса укажите вес тела; противовес не должен превышать его.");
  if (timed && data.rir != null) throw httpError(400, "Для удержания запас повторений не применяется");
  if (timed) {
    if (!Number.isSafeInteger(data.durationSeconds) || data.durationSeconds! < 1 || data.durationSeconds! > 86400 || data.weightKg !== 0 || data.reps !== 0) {
      throw httpError(400, "Для планки укажи время от 1 до 86400 секунд, без веса и повторов");
    }
  } else if (data.durationSeconds != null) {
    throw httpError(400, "Для этого упражнения учитываются повторения, не секунды");
  }
  if (!timed && exercise.equipment === "barbell" && data.weightKg < BAR_WEIGHT_KG) {
    throw httpError(400, "Вес штанги с грифом не может быть меньше 20 кг");
  }
  if (!timed && (!Number.isSafeInteger(data.reps) || data.reps <= 0 || !Number.isFinite(data.weightKg * data.reps))) {
    throw httpError(400, "Количество повторов должно быть положительным целым числом");
  }
  const rawPlan = (await readProgressEntries()).find(([key]) => key === PLAN_PREFIX + workout.id)?.[1];
  const plan = rawPlan ? JSON.parse(rawPlan) as TemplatePlan : null;
  const calibration = !isAssisted(exercise) && plan?.exercises.find(ex => ex.exerciseId === exercise.id && ex.calibration && !state.sets.some(set => set.workoutId === workout.id && set.exerciseId === exercise.id));
  if (calibration && (coach.data.rir == null || coach.data.technique == null)) throw httpError(400, "После подборочного подхода отметьте запас повторений и технику.");
  const set: SetRow = {
    equipment: exercise.equipment,
    id: state.nextSetId++,
    workoutId,
    exerciseId: exercise.id,
    weightKg: Number(data.weightKg),
    reps: Number(data.reps),
    ...(timed ? { durationSeconds: data.durationSeconds } : {}),
    ...(!timed && (exercise.equipment === "bodyweight" || isAssisted(exercise)) && state.profile.bodyWeightKg != null ? { bodyWeightKg: state.profile.bodyWeightKg } : {}),
    ...(isAssisted(exercise) ? { loadMode: "assisted" as const } : {}),
    ...(!timed && exercise.equipment === "dumbbell" ? { dumbbellCount: exercise.dumbbellCount ?? 1 } : {}),
    ...coach.data,
    setType: "working",
    createdAt: new Date().toISOString(),
  };
  state.sets.push(set);
  if (calibration && plan) plan.exercises = plan.exercises.map(ex => ex === calibration ? calibrateRemaining({ ...ex, weightStepKg: exercise.weightStepKg ?? ex.weightStepKg }, { ...set, setType: "working" }, 1) : ex);
  if (workout.draft) {
    const { sourceTimer: _sourceTimer, ...draft } = workout.draft;
    workout.draft = draft.exerciseId === set.exerciseId ? { ...draft, rir: set.rir ?? null, technique: set.technique ?? null } : undefined;
    workout.draftRevision = (workout.draftRevision ?? 0) + 1;
    if (commitRevision != null) {
      workout.lastDraftCommit = { revision: commitRevision, setId: set.id };
      if (plan) {
        const sets = state.sets.filter(set => set.workoutId === workout.id);
        const remaining = (ex: TemplateExercise) => completedTargets(ex, sets) < ex.sets;
        const next = plan.exercises.find(ex => ex.exerciseId === set.exerciseId && remaining(ex)) ?? plan.exercises.find(remaining);
        if (next && (next.setTargets || next.exerciseId !== set.exerciseId)) workout.draft = selectWorkoutDraft(findExercise(state, next.exerciseId)!, plannedSet(next, completedTargets(next, sets)), null, sets);
      }
    }
  }
  if (calibration && plan) await saveStateAndPlans(state, [[PLAN_PREFIX + workout.id, JSON.stringify(plan)]]);
  else await saveState(state);
  return enrichSet(state, set);
}

async function deleteSet(state: OfflineState, setId: number): Promise<void> {
  const existing = state.sets.some((item) => item.id === setId);
  if (!existing) throw httpError(404, "Подход не найден");
  state.sets = state.sets.filter((item) => item.id !== setId);
  for (const workout of state.workouts) if (workout.lastDraftCommit?.setId === setId) delete workout.lastDraftCommit;
  await saveState(state);
}

async function finishWorkout(state: OfflineState, workoutId: number): Promise<WorkoutReport> {
  const workout = state.workouts.find((item) => item.id === workoutId);
  if (!workout) throw httpError(404, "Тренировка не найдена");
  if (workout.finishedAt != null) return buildWorkoutReport(state, workout);
  workout.finishedAt = new Date().toISOString();
  delete workout.timer;
  delete workout.draft;
  delete workout.draftRevision;
  delete workout.lastDraftCommit;
  const report = buildWorkoutReport(state, workout);
  const jobs = (await readAutomaticBackupJobs()).filter(job => job.workoutId !== workoutId);
  if ((await readAutomaticBackupSettings()).enabled) {
    jobs.push({ workoutId, finishedAt: workout.finishedAt });
  }
  await saveStateAndPlans(state, [[AUTO_BACKUP_JOBS_KEY, JSON.stringify(jobs)]], [PLAN_PREFIX + workoutId]);
  return report;
}

function workoutResponse(state: OfflineState, workout: WorkoutRow): Workout {
  const sets = state.sets
    .filter((item) => item.workoutId === workout.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => enrichSet(state, item));
  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    sets,
    ...totalsFromSets(sets),
  };
}

function summarizeWorkout(state: OfflineState, workout: WorkoutRow): WorkoutSummary & DurationMetrics {
  const full = workoutResponse(state, workout);
  const byExercise = new Map<number, { name: string; volume: number }>();
  for (const set of full.sets) {
    const item = byExercise.get(set.exerciseId) ?? { name: set.exerciseName, volume: 0 };
    item.volume += set.volume;
    byExercise.set(set.exerciseId, item);
  }
  return {
    id: full.id,
    name: full.name,
    startedAt: full.startedAt,
    finishedAt: full.finishedAt,
    totalVolume: full.totalVolume,
    totalReps: full.totalReps,
    totalSets: full.totalSets,
    durationSeconds: durationOf(full),
    exerciseCount: byExercise.size,
    topExercises: [...byExercise.values()]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3)
      .map((item) => item.name),
  };
}

function enrichSet(state: OfflineState, set: SetRow): MeasuredSet {
  const exercise = findExercise(state, set.exerciseId);
  const timed = isTimedExercise(exercise?.name ?? "") || set.durationSeconds != null;
  const equipment = set.equipment ?? exercise?.equipment;
  const bodyweight = !timed && (equipment === "bodyweight" || isAssisted(set));
  const bodyWeightKg = bodyweight ? set.bodyWeightKg ?? state.profile.bodyWeightKg : null;
  return {
    id: set.id,
    workoutId: set.workoutId,
    exerciseId: set.exerciseId,
    exerciseName: exercise?.name ?? "Упражнение",
    muscleGroup: exercise?.muscleGroup ?? "Другое",
    weightKg: timed ? 0 : set.weightKg,
    reps: timed ? 0 : set.reps,
    equipment,
    ...(set.loadMode ? { loadMode: set.loadMode } : {}),
    ...(set.dumbbellCount ? { dumbbellCount: set.dumbbellCount } : {}),
    volume: setVolume(set.weightKg, set.reps, equipment, bodyWeightKg, timed, set),
    ...(bodyweight ? { ...(bodyWeightKg != null ? { bodyWeightKg } : {}), bodyWeightEstimated: set.bodyWeightKg == null, effectiveWeightKg: isAssisted(set) ? Math.max(0, (bodyWeightKg ?? 0) - set.weightKg) : (bodyWeightKg ?? 0) + set.weightKg } : {}),
    ...(timed ? { durationSeconds: set.durationSeconds ?? 0 } : {}),
    ...(set.setType ? { setType: set.setType } : {}),
    ...(set.rir !== undefined ? { rir: set.rir } : {}),
    ...(set.technique !== undefined ? { technique: set.technique } : {}),
    createdAt: set.createdAt,
  };
}

function getFinishedSets(state: OfflineState) {
  const workoutById = new Map(state.workouts.map((item) => [item.id, item]));
  return state.sets
    .map((set) => {
      const workout = workoutById.get(set.workoutId);
      if (!workout || workout.finishedAt == null) return null;
      return {
        ...enrichSet(state, set),
        workoutStartedAt: workout.startedAt,
        workoutFinishedAt: workout.finishedAt,
        workoutName: workout.name,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function totalsFromSets(sets: Array<Pick<WorkoutSet, "volume" | "reps">>) {
  return {
    totalVolume: round(sets.reduce((sum, set) => sum + set.volume, 0)),
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    totalSets: sets.length,
    durationSeconds: sets.reduce((sum, set) => sum + durationOf(set), 0),
  };
}

function buildWorkoutReport(state: OfflineState, workout: WorkoutRow): WorkoutReport {
  const full = workoutResponse(state, workout);
  const previousSets = getFinishedSets(state).filter(
    (set) => set.workoutId !== workout.id && new Date(set.workoutStartedAt) < new Date(workout.startedAt),
  );
  const currentMaxWeight = full.sets.filter(set => !isAssisted(set as MeasuredSet)).reduce((best, set) => Math.max(best, set.weightKg), 0);
  const previousByWorkout = groupBy(previousSets, (set) => String(set.workoutId));
  let prevBestTonnage = 0;
  let prevBestReps = 0;
  let prevBestMaxWeight = 0;
  for (const sets of previousByWorkout.values()) {
    const totals = totalsFromSets(sets);
    prevBestTonnage = Math.max(prevBestTonnage, totals.totalVolume);
    prevBestReps = Math.max(prevBestReps, totals.totalReps);
    prevBestMaxWeight = Math.max(prevBestMaxWeight, ...sets.filter(set => !isAssisted(set)).map((set) => set.weightKg), 0);
  }

  const newPersonalRecords = full.sets.length > 0
    ? [
        full.totalVolume > prevBestTonnage
          ? { kind: "tonnage" as const, value: full.totalVolume, previous: prevBestTonnage, delta: round(full.totalVolume - prevBestTonnage) }
          : null,
        full.totalReps > prevBestReps
          ? { kind: "reps" as const, value: full.totalReps, previous: prevBestReps, delta: full.totalReps - prevBestReps }
          : null,
        currentMaxWeight > prevBestMaxWeight
          ? { kind: "max_weight" as const, value: currentMaxWeight, previous: prevBestMaxWeight, delta: round(currentMaxWeight - prevBestMaxWeight) }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null)
    : [];

  const categoryKey = (set: MeasuredSet) => `${set.exerciseId}:${set.equipment}:${isAssisted(set)}`;
  const previousBest = new Map<string, { maxWeight: number; maxReps: number; maxVolumeSet: number }>();
  for (const set of previousSets) {
    const key = categoryKey(set);
    const best = previousBest.get(key) ?? { maxWeight: 0, maxReps: 0, maxVolumeSet: 0 };
    best.maxWeight = Math.max(best.maxWeight, set.weightKg);
    best.maxReps = Math.max(best.maxReps, set.reps);
    best.maxVolumeSet = Math.max(best.maxVolumeSet, set.volume);
    previousBest.set(key, best);
  }
  const currentByExercise = groupBy(full.sets, (set) => String(set.exerciseId));
  const newExerciseRecords = [...currentByExercise.entries()].flatMap(([exerciseIdText, sets]) => {
    const exerciseId = Number(exerciseIdText);
    const category = sets[0] as MeasuredSet & { equipment: Equipment };
    if (sets.some(set => !sameLoadCategory(set as MeasuredSet, category))) return [];
    const prev = previousBest.get(categoryKey(category)) ?? { maxWeight: 0, maxReps: 0, maxVolumeSet: 0 };
    const topWeight = sets.reduce((best, set) => (set.weightKg > best.weightKg ? set : best), sets[0]);
    const topReps = sets.reduce((best, set) => (set.reps > best.reps ? set : best), sets[0]);
    const topVolume = sets.reduce((best, set) => (set.volume > best.volume ? set : best), sets[0]);
    const rows = [
      !isAssisted(topWeight as MeasuredSet) && topWeight.weightKg > prev.maxWeight
        ? { exerciseId, exerciseName: topWeight.exerciseName, muscleGroup: topWeight.muscleGroup, kind: "max_weight" as const, value: topWeight.weightKg, previous: prev.maxWeight, reps: topWeight.reps, weightKg: topWeight.weightKg }
        : null,
      topReps.reps > prev.maxReps
        ? { exerciseId, exerciseName: topReps.exerciseName, muscleGroup: topReps.muscleGroup, kind: "max_reps" as const, value: topReps.reps, previous: prev.maxReps, reps: topReps.reps, weightKg: topReps.weightKg }
        : null,
      topVolume.volume > prev.maxVolumeSet
        ? { exerciseId, exerciseName: topVolume.exerciseName, muscleGroup: topVolume.muscleGroup, kind: "max_volume_set" as const, value: topVolume.volume, previous: prev.maxVolumeSet, reps: topVolume.reps, weightKg: topVolume.weightKg }
        : null,
    ];
    return rows.filter((item): item is NonNullable<typeof item> => item !== null);
  });

  const recordExerciseIds = new Set(newExerciseRecords.map((item) => item.exerciseId));
  return {
    workout: full,
    newPersonalRecords,
    newExerciseRecords,
    durationMinutes: workout.finishedAt ? round((new Date(workout.finishedAt).getTime() - new Date(workout.startedAt).getTime()) / 60000, 1) : 0,
    exerciseBreakdown: computeExerciseBreakdown(state, workout.id, recordExerciseIds),
  };
}

function getWorkoutComparison(state: OfflineState, workoutId: number): WorkoutComparison {
  const workout = state.workouts.find((item) => item.id === workoutId);
  if (!workout) throw httpError(404, "Тренировка не найдена");
  const current = workoutResponse(state, workout);
  const currentIds = new Set(current.sets.map((set) => set.exerciseId));
  const previous = state.workouts
    .filter((item) => item.finishedAt != null && item.id !== workoutId && new Date(item.startedAt) < new Date(workout.startedAt))
    .map((item) => {
      const sets = workoutResponse(state, item).sets;
      const overlap = new Set(sets.map((set) => set.exerciseId));
      let score = item.name && item.name === workout.name ? 100 : 0;
      for (const id of overlap) if (currentIds.has(id)) score += 1;
      return { workout: item, sets, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.workout.startedAt).getTime() - new Date(a.workout.startedAt).getTime())[0];

  const previousSets = previous?.sets ?? [];
  const previousTotals = totalsFromSets(previousSets.filter((set) => currentIds.has(set.exerciseId)));
  const currentByExercise = groupBy(current.sets, (set) => String(set.exerciseId));
  const previousByExercise = groupBy(previousSets, (set) => String(set.exerciseId));
  const exercises = [...currentByExercise.entries()].map(([exerciseIdText, sets]) => {
    const exerciseId = Number(exerciseIdText);
    const previousForExercise = previousByExercise.get(exerciseIdText) ?? [];
    const cur = aggregateSets(sets);
    const prev = aggregateSets(previousForExercise);
    return {
      exerciseId,
      name: sets[0]?.exerciseName ?? "",
      currentVolume: cur.volume,
      previousVolume: prev.volume,
      deltaVolume: round(cur.volume - prev.volume),
      currentMaxWeight: cur.maxWeight,
      previousMaxWeight: prev.maxWeight,
      deltaMaxWeight: round(cur.maxWeight - prev.maxWeight),
      currentReps: cur.reps,
      previousReps: prev.reps,
      deltaReps: cur.reps - prev.reps,
    };
  });

  return {
    workoutId,
    previousWorkoutId: previous?.workout.id ?? null,
    previousWorkoutDate: previous?.workout.startedAt ?? null,
    previousWorkoutName: previous?.workout.name ?? null,
    deltaVolume: round(current.totalVolume - previousTotals.totalVolume),
    deltaReps: current.totalReps - previousTotals.totalReps,
    deltaSets: current.totalSets - previousTotals.totalSets,
    durationDeltaMinutes: null,
    exercises,
  };
}

function getWorkoutExerciseBreakdown(
  state: OfflineState,
  workoutId: number,
): WorkoutExerciseBreakdownResponse {
  return { workoutId, items: computeExerciseBreakdown(state, workoutId) };
}

function computeExerciseBreakdown(
  state: OfflineState,
  workoutId: number,
  recordExerciseIds = new Set<number>(),
): WorkoutExerciseBreakdownItem[] {
  const workout = state.workouts.find((item) => item.id === workoutId);
  if (!workout) throw httpError(404, "Тренировка не найдена");
  const currentSets = workoutResponse(state, workout).sets;
  const currentByExercise = groupBy(currentSets, (set) => String(set.exerciseId));
  const previousSets = getFinishedSets(state).filter(
    (set) => set.workoutId !== workoutId && new Date(set.workoutStartedAt) < new Date(workout.startedAt),
  );
  return [...currentByExercise.entries()].map(([exerciseIdText, sets]) => {
    const exerciseId = Number(exerciseIdText);
    const current = aggregateSets(sets);
    const previousSessions = groupBy(
      previousSets.filter((set) => set.exerciseId === exerciseId && sets.every(current => sameLoadCategory(current as MeasuredSet, set as MeasuredSet & { equipment: Equipment }))),
      (set) => String(set.workoutId),
    );
    const previous = [...previousSessions.values()]
      .map((sessionSets) => ({ sets: sessionSets, aggregate: aggregateSets(sessionSets) }))
      .sort((a, b) => new Date(b.sets[0].workoutStartedAt).getTime() - new Date(a.sets[0].workoutStartedAt).getTime())[0];
    const topSet = sets.reduce((best, set) => (performanceWeight(set) > performanceWeight(best) ? set : best), sets[0]);
    return {
      exerciseId,
      exerciseName: sets[0].exerciseName,
      muscleGroup: sets[0].muscleGroup,
      sets: sets.length,
      reps: current.reps,
      volume: current.volume,
      durationSeconds: sets.reduce((sum, set) => sum + durationOf(set), 0),
      topSetWeight: performanceWeight(topSet),
      topSetReps: topSet.reps,
      previousSessionWorkoutId: previous?.sets[0].workoutId ?? null,
      previousSessionWorkoutName: previous?.sets[0].workoutName ?? null,
      previousSessionDate: previous?.sets[0].workoutStartedAt ?? null,
      previousSessionVolume: previous?.aggregate.volume ?? null,
      previousSessionTopWeight: previous?.aggregate.maxWeight ?? null,
      previousSessionTotalReps: previous?.aggregate.reps ?? null,
      deltaVolume: previous ? round(current.volume - previous.aggregate.volume) : null,
      deltaTopWeight: previous ? round(current.maxWeight - previous.aggregate.maxWeight) : null,
      deltaReps: previous ? current.reps - previous.aggregate.reps : null,
      isPersonalRecord: recordExerciseIds.has(exerciseId),
    };
  });
}

function getStatsOverview(state: OfflineState): StatsOverview & DurationMetrics {
  const sets = getFinishedSets(state);
  const workouts = state.workouts.filter((item) => item.finishedAt != null);
  const byWorkout = groupBy(sets, (set) => String(set.workoutId));
  let bestTonnage = 0;
  let bestReps = 0;
  let bestMaxWeight = 0;
  for (const workoutSets of byWorkout.values()) {
    const totals = totalsFromSets(workoutSets);
    bestTonnage = Math.max(bestTonnage, totals.totalVolume);
    bestReps = Math.max(bestReps, totals.totalReps);
    bestMaxWeight = Math.max(bestMaxWeight, ...workoutSets.map(performanceWeight), 0);
  }
  const totals = totalsFromSets(sets);
  const topExercises = [...groupBy(sets, (set) => String(set.exerciseId)).entries()]
    .map(([exerciseIdText, exerciseSets]) => {
      const agg = aggregateSets(exerciseSets);
      return {
        exerciseId: Number(exerciseIdText),
        name: exerciseSets[0].exerciseName,
        muscleGroup: exerciseSets[0].muscleGroup,
        sets: exerciseSets.length,
        volume: agg.volume,
        maxWeightKg: agg.maxWeight,
        durationSeconds: exerciseSets.reduce((sum, set) => sum + durationOf(set), 0),
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  const muscleGroupVolume = [...groupBy(sets, (set) => set.muscleGroup).entries()]
    .map(([muscleGroup, muscleSets]) => ({
      muscleGroup,
      volume: aggregateSets(muscleSets).volume,
      sets: muscleSets.length,
    }))
    .sort((a, b) => b.volume - a.volume);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    totalWorkouts: workouts.length,
    totalVolume: totals.totalVolume,
    totalReps: totals.totalReps,
    totalSets: totals.totalSets,
    durationSeconds: totals.durationSeconds,
    bestTonnage,
    bestReps,
    bestMaxWeight,
    currentStreakDays: currentStreak(workouts.map((item) => item.startedAt)),
    weekWorkouts: workouts.filter((item) => new Date(item.startedAt).getTime() >= weekAgo).length,
    topExercises,
    muscleGroupVolume,
  };
}

function getProgress(state: OfflineState): ProgressSeries {
  const finished = state.workouts
    .filter((item) => item.finishedAt != null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  return {
    points: finished.map((workout) => {
      const full = workoutResponse(state, workout);
      return {
        workoutId: workout.id,
        date: workout.startedAt,
        volume: full.totalVolume,
        reps: full.totalReps,
        durationSeconds: durationOf(full),
        maxWeight: full.sets.reduce((best, set) => Math.max(best, performanceWeight(set)), 0),
      };
    }),
  };
}

function getExerciseProgress(state: OfflineState, exerciseId: number): ExerciseProgress {
  const exercise = findExercise(state, exerciseId);
  if (!exercise) throw httpError(404, "Упражнение не найдено");
  const unit = exerciseStandard(exercise, state.profile).unit;
  const points = [...groupBy(getFinishedSets(state).filter((set) => set.exerciseId === exerciseId && sameLoadCategory(set, exercise)), (set) => String(set.workoutId)).values()]
    .map((sets) => {
      const score = (set: MeasuredSet) => unit === "seconds" ? durationOf(set) : unit === "reps" ? set.reps : performanceWeight(set);
      const topSet = sets.reduce((best, set) => (score(set) > score(best) ? set : best), sets[0]);
      const aggregate = aggregateSets(sets);
      return {
        workoutId: sets[0].workoutId,
        date: sets[0].workoutStartedAt,
        volume: aggregate.volume,
        reps: aggregate.reps,
        maxWeight: aggregate.maxWeight,
        durationSeconds: sets.reduce((sum, set) => sum + durationOf(set), 0),
        maxDurationSeconds: Math.max(...sets.map(durationOf)),
        topSet: { weightKg: topSet.weightKg, reps: topSet.reps, durationSeconds: durationOf(topSet) },
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { exercise: enrichExercise(state, exercise), points };
}

function getHeatmap(state: OfflineState, requestedDays: number): HeatmapResponse {
  const days = Math.max(7, Math.min(requestedDays, 730));
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const buckets = new Map<string, { volume: number; sets: number }>();
  for (const set of getFinishedSets(state)) {
    const created = new Date(set.createdAt);
    if (created < start) continue;
    const key = dateKey(created);
    const bucket = buckets.get(key) ?? { volume: 0, sets: 0 };
    bucket.volume += set.volume;
    bucket.sets += 1;
    buckets.set(key, bucket);
  }
  const maxVolume = Math.max(...[...buckets.values()].map((item) => item.volume), 0);
  const out = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = dateKey(cursor);
    const bucket = buckets.get(key) ?? { volume: 0, sets: 0 };
    out.push({
      date: key,
      volume: round(bucket.volume),
      sets: bucket.sets,
      intensity: bucket.sets > 0 ? Math.max(1, maxVolume > 0 ? Math.ceil((bucket.volume / maxVolume) * 4) : 1) : 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return {
    days: out,
    maxVolume: round(maxVolume),
    totalDays: out.length,
    activeDays: out.filter((item) => item.sets > 0).length,
  };
}

async function getLevelForecast(state: OfflineState): Promise<LevelForecast> {
  const levels = await getLevels(state);
  const tonnage7dKg = getTonnageSince(state, Date.now() - 7 * 24 * 60 * 60 * 1000);
  const target = levels.nextLevelTonnage7dKgRequired ?? 0;
  const needed = Math.max(0, target - levels.stats.currentTonnageSinceLevelUp);
  const avgDaily = tonnage7dKg / 7;
  return {
    currentLevel: levels.currentLevel,
    nextLevel: levels.nextLevel,
    nextLevelName: levels.nextLevel != null ? levels.levels[levels.nextLevel]?.name ?? null : null,
    tonnageNeededKg: round(needed),
    tonnage7dKg: round(tonnage7dKg),
    avgDailyTonnageKg: round(avgDaily),
    estimatedDays: null,
    confidence: levels.nextLevel == null ? "achieved" : "low",
  };
}

async function getLevels(state: OfflineState): Promise<ExerciseLevelsResponse> {
  const bodyWeightKg = state.profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
  const sex = state.profile.sex ?? "male";
  const levels = buildLevels(bodyWeightKg, sex);
  const observed = new Map<number, { kg: number; reps: number; seconds: number }>();
  for (const set of getFinishedSets(state)) {
    if (!sameLoadCategory(set, findExercise(state, set.exerciseId)!)) continue;
    const best = observed.get(set.exerciseId) ?? { kg: 0, reps: 0, seconds: 0 };
    best.kg = Math.max(best.kg, performanceWeight(set)); best.reps = Math.max(best.reps, set.reps); best.seconds = Math.max(best.seconds, durationOf(set));
    observed.set(set.exerciseId, best);
  }
  const candidates = state.exercises.filter(ex => !ex.deletedAt || observed.has(ex.id)).map(exercise => {
    const standard = exerciseStandard(exercise, state.profile);
    const best = observed.get(exercise.id);
    const bestValue = standard.unit === "kg" ? best?.kg ?? 0 : standard.unit === "reps" ? best?.reps ?? 0 : best?.seconds ?? 0;
    const achievedLevel = achievedExerciseLevel(standard, exercise.equipment, bestValue, !!best);
    return { exercise, standard, bestValue, achievedLevel, maxWeightKg: best?.kg ?? 0, hasRecordedResult: !!best };
  });
  const currentLevel = levelFromExercises(candidates.map(row => ({ exerciseId: row.exercise.id, achievedLevel: row.achievedLevel })));
  if (state.confirmedLevel !== currentLevel) {
    state.confirmedLevel = currentLevel;
    state.levelUpAt = new Date().toISOString();
    await saveState(state);
  }
  const nextLevel = currentLevel >= 80 ? null : currentLevel + 1;
  const mainStats: LevelExerciseStat[] = candidates.map(({ exercise, standard, bestValue, achievedLevel, maxWeightKg, hasRecordedResult }) => {
    const mcKg = standard.unit === "kg" ? standard.entries.at(-1)!.target : null;
    const required = targetForExerciseLevel(standard, exercise.equipment, nextLevel ?? 80);
    return {
      exerciseId: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment, loadMode: exercise.loadMode, maxWeightKg, standard, bestValue, achievedLevel, hasRecordedResult,
      requiredValueForNextLevel: nextLevel == null ? null : required,
      multiplier: mcKg == null ? 0 : mcKg / bodyWeightKg,
      requiredKgForNextLevel: nextLevel == null || standard.unit !== "kg" ? null : required,
      requiredKgPenaltyMultiplier: 1, autoPassedReason: null,
      mcKg, mcSource: standard.official ? "classic" as const : standard.unit === "seconds" ? "time" as const : standard.unit === "reps" ? "bodyweight" as const : "coefficient" as const,
    };
  }).sort((a, b) => b.achievedLevel - a.achievedLevel || b.bestValue / Math.max(b.requiredValueForNextLevel ?? 1, 1) - a.bestValue / Math.max(a.requiredValueForNextLevel ?? 1, 1) || a.name.localeCompare(b.name, "ru"));
  const currentRank = rankForGameLevel(currentLevel);
  return {
    levels, currentLevel, bestLevelEver: currentLevel, nextLevel, confirmedLevel: currentLevel,
    nextLevelPenaltyMultiplier: 1, nextLevelTonnage7dKgRequired: null,
    bodyWeightKg, bodyWeightIsFallback: state.profile.bodyWeightKg == null,
    barWeightKg: BAR_WEIGHT_KG, levelFactorAnchor: LEVEL_FACTOR_ANCHOR,
    currentRank, weightClassKg: weightClass(bodyWeightKg, sex).kg, sex,
    confirmedLevelMigrationNeeded: false, maxClaimableLevel: null,
    stats: {
      currentTonnageSinceLevelUp: round(getTonnageSince(state, state.levelUpAt ? Date.parse(state.levelUpAt) : 0)),
      maxTonnage7dKg: round(getTonnageSince(state, Date.now() - 7 * 86400000)),
      levelUpAt: state.levelUpAt, mainExercises: mainStats,
    },
  };
}

async function claimLevel(state: OfflineState, targetLevel: number): Promise<ClaimLevelResult> {
  if (!Number.isInteger(targetLevel) || targetLevel < 1) throw httpError(400, "Invalid level");
  const levels = await getLevels(state);
  if (targetLevel <= levels.confirmedLevel) {
    throw httpError(400, "Target level must be above current confirmed level");
  }
  if (levels.maxClaimableLevel == null || targetLevel > levels.maxClaimableLevel) {
    throw httpError(400, "Requirements not met for this level");
  }
  state.confirmedLevel = targetLevel;
  state.levelUpAt = new Date().toISOString();
  await saveState(state);
  return { confirmedLevel: targetLevel };
}

function getMaxWeightByExercise(state: OfflineState): Map<number, number> {
  const out = new Map<number, number>();
  for (const set of getFinishedSets(state)) {
    out.set(set.exerciseId, Math.max(out.get(set.exerciseId) ?? 0, set.weightKg));
  }
  return out;
}

async function updateProfile(state: OfflineState, body: RequestBody): Promise<Profile> {
  const input = body as unknown as UpdateProfileInput;
  if (input.bodyWeightKg != null && (typeof input.bodyWeightKg !== "number" || !Number.isFinite(input.bodyWeightKg) || input.bodyWeightKg < 20 || input.bodyWeightKg > 500)) throw httpError(400, "Вес тела должен быть от 20 до 500 кг");
  if (input.sex != null && input.sex !== "male" && input.sex !== "female") throw httpError(400, "Некорректный пол");
  if (input.heightCm != null && (typeof input.heightCm !== "number" || !Number.isFinite(input.heightCm) || input.heightCm <= 0)) throw httpError(400, "Рост должен быть положительным числом");
  state.profile = normalizeProfile({
    ...state.profile,
    bodyWeightKg: input.bodyWeightKg === undefined ? state.profile.bodyWeightKg : input.bodyWeightKg,
    heightCm: input.heightCm === undefined ? state.profile.heightCm : input.heightCm,
    sex: input.sex ?? state.profile.sex ?? "male",
  });
  await saveState(state);
  return state.profile;
}

function listPrograms(state: OfflineState): ProgramsListResponse {
  const custom = state.customPrograms.map((item) => ({
    id: String(item.id),
    name: item.name,
    description: item.description,
    emoji: "⚡",
    exerciseCount: item.exercises.length,
    isCustom: true,
  }));
  return { programs: custom };
}

function parseCustomProgram(state: OfflineState, body: RequestBody) {
  const parsed = templateInputSchema.safeParse(body);
  if (!parsed.success) throw httpError(400, "Проверьте название, подходы, веса и повторы шаблона.");
  for (const def of parsed.data.exercises) {
    const exercise = findExercise(state, def.exerciseId);
    if (!exercise || exercise.deletedAt || !validateTargets(exercise, def.setTargets)) throw httpError(400, "Проверьте упражнения, вес штанги и время удержания. Удалённые упражнения недоступны.");
  }
  return { ...parsed.data, exercises: parsed.data.exercises.map(({ exerciseId, sets, repsMin, repsMax, intent, note, setTargets, weightStepKg, targetRir }) => ({ exerciseId, sets, repsMin, repsMax, intent, note, ...(setTargets ? { setTargets: setTargets.map(set => ({ ...set, setType: "working" as const })) } : {}), ...(weightStepKg != null ? { weightStepKg } : {}), ...(targetRir != null ? { targetRir } : {}) })) };
}

async function createCustomProgram(state: OfflineState, body: RequestBody): Promise<ProgramSummary> {
  const input = parseCustomProgram(state, body);
  const row: CustomProgramRow = {
    id: state.nextProgramId++,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    exercises: input.exercises,
  };
  state.customPrograms.push(row);
  await saveState(state);
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    emoji: "⚡",
    exerciseCount: row.exercises.length,
    isCustom: true,
  };
}

async function updateCustomProgram(
  state: OfflineState,
  programId: string,
  body: RequestBody,
): Promise<ProgramSummary> {
  const id = Number(programId);
  const row = state.customPrograms.find((item) => item.id === id);
  if (!row) throw httpError(404, "Программа не найдена");
  const input = parseCustomProgram(state, body);
  row.name = input.name.trim();
  row.description = input.description?.trim() ?? "";
  row.exercises = input.exercises;
  await saveState(state);
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    emoji: "⚡",
    exerciseCount: row.exercises.length,
    isCustom: true,
  };
}

async function deleteCustomProgram(state: OfflineState, programId: string): Promise<void> {
  const id = Number(programId);
  const exists = state.customPrograms.some((item) => item.id === id);
  if (!exists) throw httpError(404, "Программа не найдена");
  state.customPrograms = state.customPrograms.filter((item) => item.id !== id);
  await saveState(state);
}

async function getProgramPlan(state: OfflineState, programId: string): Promise<TemplatePlan> {
  const builtIn = PROGRAMS.find((item) => item.id === programId);
  const custom = builtIn ? null : state.customPrograms.find((item) => String(item.id) === programId);
  if (!builtIn && !custom) throw httpError(404, "Программа не найдена");

  const levels = await getLevels(state);
  const basedOnLevel = levels.currentLevel;
  const benchmarkKg = referenceKg(basedOnLevel, levels.bodyWeightKg);
  const defs = builtIn
    ? builtIn.exercises.map((item) => ({ ...item, exerciseId: findExerciseByName(state, item.name)?.id }))
    : custom!.exercises;
  const exercises = defs
    .map((def) => {
      const exercise = "name" in def && typeof def.name === "string"
        ? findExerciseByName(state, def.name)
        : findExercise(state, Number(def.exerciseId));
      if (!exercise || exercise.deletedAt) return null;
      const pr = getFinishedSets(state)
        .filter((set) => set.exerciseId === exercise.id && sameLoadCategory(set, exercise))
        .reduce((best, set) => Math.max(best, set.weightKg), 0);
      const factor = INTENT_FACTOR[def.intent];
      const minimum = exercise.equipment === "barbell" ? BAR_WEIGHT_KG : 2.5;
      const estimated = minimum;
      const timed = isTimedExercise(exercise.name);
      const setTargets = "setTargets" in def ? (def.setTargets as SetTarget[] | undefined)?.map(set => ({ ...set, setType: "working" as const })) : undefined;
      const progression: Progression = { ...("weightStepKg" in def && def.weightStepKg != null ? { weightStepKg: def.weightStepKg } : {}), ...("targetRir" in def && def.targetRir != null ? { targetRir: def.targetRir } : {}) };
      const suggestedWeightKg = timed || (exercise.equipment === "bodyweight" && pr <= 0)
        ? 0
        : Math.max(exercise.equipment === "bodyweight" ? 0 : minimum, roundTo(pr > 0 ? pr * factor : estimated, 2.5));
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: def.sets,
        repsMin: timed && !setTargets ? 30 : def.repsMin,
        repsMax: timed && !setTargets ? 60 : def.repsMax,
        intent: def.intent,
        suggestedWeightKg: setTargets?.[0]?.weightKg ?? (isAssisted(exercise) ? getFinishedSets(state).filter(set => set.exerciseId === exercise.id && sameLoadCategory(set, exercise)).at(-1)?.weightKg ?? Math.min(20, state.profile.bodyWeightKg ?? 20) : suggestedWeightKg),
        ...("calibration" in def && def.calibration ? { calibration: true } : {}),
        ...(setTargets ? { setTargets } : {}),
        ...progression,
        ...(exercise.weightStepKg != null ? { weightStepKg: exercise.weightStepKg } : {}),
        isBodyweight: exercise.equipment === "bodyweight",
        equipment: exercise.equipment,
        basedOn: pr > 0 ? "personal-record" : "level-benchmark",
        note: def.note ?? null,
      } satisfies TemplateExercise;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    id: builtIn?.id ?? String(custom!.id),
    name: builtIn?.name ?? custom!.name,
    description: builtIn?.description ?? custom!.description,
    emoji: builtIn?.emoji ?? "⚡",
    basedOnLevel,
    basedOnLevelName: levels.levels[basedOnLevel]?.name ?? `Уровень ${basedOnLevel}`,
    benchmarkKg,
    isCustom: !builtIn,
    exercises,
  };
}

function findExerciseByName(state: OfflineState, name: string): ExerciseRow | null {
  return state.exercises.find((item) => item.name === name) ?? null;
}

function buildLevels(bodyWeightKg: number, sex: "male" | "female"): Level[] {
  return getLevelLabels(sex).map(([name, description], level) => ({
    level,
    name,
    description,
    tier: Math.min(8, Math.floor(level / 9)),
    benchmarkKg: referenceKg(level, bodyWeightKg),
    tonnage7dKgRequired: 0,
    mainExercisesRequired: level === 0 ? 0 : 3,
    rank: rankForGameLevel(level),
  }));
}

function referenceKg(level: number, bodyWeightKg: number): number {
  if (level <= 0) return 0;
  return roundTo(bodyWeightKg * (level / LEVEL_FACTOR_ANCHOR), 2.5);
}

function getTonnageSince(state: OfflineState, timestamp: number): number {
  return getFinishedSets(state)
    .filter((set) => new Date(set.createdAt).getTime() >= timestamp)
    .reduce((sum, set) => sum + set.volume, 0);
}

function getMcKg(state: OfflineState, exercise: ExerciseRow): { kg: number | null; source: ExerciseRankNorms["mcSource"] } {
  const lift = !exercise.isCustom && exercise.equipment === "barbell" ? liftForExercise(exercise.name) : null;
  if (!lift) return { kg: null, source: "fallback" };
  return { kg: msmcTarget(lift, state.profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG, state.profile.sex ?? "male"), source: "classic" };
}

function aggregateSets(sets: Array<Pick<WorkoutSet, "volume" | "reps" | "weightKg">>) {
  return {
    volume: round(sets.reduce((sum, set) => sum + set.volume, 0)),
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    maxWeight: sets.reduce((best, set) => Math.max(best, performanceWeight(set)), 0),
  };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}

function currentStreak(dates: string[]): number {
  const days = new Set(dates.map((item) => dateKey(new Date(item))));
  let cursor = startOfDay(new Date());
  if (!days.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function isEquipment(value: unknown): value is Equipment {
  return value === "barbell" || value === "dumbbell" || value === "bodyweight" || value === "machine" || value === "other";
}

function httpError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}
