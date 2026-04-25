import { db, exercisesTable, workoutSetsTable, workoutsTable, appMetaTable } from "@workspace/db";
import { eq, and, isNotNull, asc, inArray, sql } from "drizzle-orm";
import {
  getProfile,
  getConfirmedLevel,
  setConfirmedLevel,
  FALLBACK_BODY_WEIGHT_KG,
  FALLBACK_SEX,
} from "./profile";
import {
  getMcKgForExercise,
  getWeightClassKg,
  rankForLevel,
  rankForMcPercent,
  type McSource,
  type SportRank,
} from "./sport-norms";

export type LevelDef = {
  level: number;
  name: string;
  description: string;
  tier: number;
  benchmarkKg: number;
  tonnage7dKgRequired: number;
  mainExercisesRequired: number;
  rank: SportRank;
};

const TIER_SIZE = 9;
const MAIN_EXERCISES_REQUIRED = 3;

// Weekly tonnage assumptions. The required tonnage per week is:
//   workouts/week × exercises/workout × sets × reps × workingWeight
// where workingWeight = bodyWeight × levelFactor(level).
// 9 reps is the midpoint of the 8–10 working-set range.
const WORKOUTS_PER_WEEK_ASSUMED = 3;
const EXERCISES_PER_WORKOUT = 5;
const SETS_PER_EXERCISE = 5;
const REPS_PER_SET = 9;

// Anchor: at level 80 (МС — Мастер спорта) the level factor is 1.0,
// meaning the per-exercise MC target equals the full MS kg norm for the user's
// weight class. All lower levels scale linearly: required_kg = mc_kg × level/80.
export const LEVEL_FACTOR_ANCHOR = 80;

// Standard Olympic bar weight. Barbell exercises whose required kg falls below
// this floor are auto-passed (treated as cleared) — you can't load a real
// barbell with less than the empty bar, so it would be silly to "block" the
// next level on, say, a 10 kg bench press requirement.
export const BAR_WEIGHT_KG = 20;

// Multi-level jump penalty: each level skipped beyond +1 from the confirmed
// level adds 10% to both tonnage and per-exercise weight requirements. So a
// jump of +1 has no penalty (×1.0), +2 has ×1.10, +3 has ×1.20, etc.
const JUMP_PENALTY_PER_LEVEL = 0.10;

const NAMES_AND_DESCRIPTIONS: Array<[string, string]> = [
  ["Дохляк", "Ты не держал ничего тяжелее компьютерной мышки."],
  ["Хилячок", "Бутылка воды кажется тебе гантелью."],
  ["Спичка", "Ветер с трудом не сносит тебя с ног."],
  ["Тощий", "Ремень делает на тебе три витка."],
  ["Слабак", "Открыть банку с огурцами — твой подвиг недели."],
  ["Доходяга", "Дверь в зал кажется тебе слишком тяжёлой."],
  ["Зубочистка", "Тебя путают с вешалкой для одежды."],
  ["Бледная немощь", "На пляже ты как тень."],
  ["Цыплёнок", "Кудахчешь над пустым грифом."],
  ["Новичок", "Ты впервые поднял штангу. И тебе стало больно."],
  ["Зелёный", "В зале ты как ребёнок в магазине игрушек."],
  ["Любитель", "Уже знаешь, что такое жим лёжа. Гордишься."],
  ["Турист", "Заходишь в зал как на экскурсию."],
  ["Школьник", "Делаешь подходы по 5 раз с пустым грифом."],
  ["Бегунок", "Думаешь, что кардио заменит силовые. Ошибаешься."],
  ["Подмастерье", "Уже не падаешь под штангой. Прогресс."],
  ["Подопечный", "Тренер всё ещё стоит рядом на всякий случай."],
  ["Старательный", "Носишь шейкер. Это уже что-то."],
  ["Стажёр", "Знаешь разницу между жимом и тягой."],
  ["Регулярный", "Ходишь в зал чаще, чем в магазин."],
  ["Самоучка", "Учишь технику по YouTube."],
  ["Начинающий", "Уже не стесняешься зеркала."],
  ["Кандидат", "Гриф уже не пугает."],
  ["Дисциплинированный", "Не пропускаешь день ног. Почти."],
  ["Постоянник", "Тебя узнают на ресепшене."],
  ["Активист", "Берёшь кардио после силовой. Иногда."],
  ["Юниор", "Можешь подсказать новичку, как держать гантель."],
  ["Спортсмен", "Форма уже заметна. Чуть-чуть."],
  ["Любитель железа", "Шейкер всегда с тобой."],
  ["Завсегдатай", "Знаешь, где лежат блины 20 кг."],
  ["Тренирующийся", "Можешь объяснить, что такое суперсет."],
  ["Уверенный", "Поднимаешь без страха травмы."],
  ["Средний", "Ты лучше большинства посетителей зала."],
  ["Прогрессирующий", "Веса растут каждую неделю."],
  ["Тренированный", "Видно, что ходишь в зал."],
  ["Опытный", "Ты знаешь, зачем нужен пояс."],
  ["Атлет", "Тебе кивают на входе."],
  ["Силач-новичок", "Жмёшь свой вес. Это уважают."],
  ["Бодибилдер-любитель", "Считаешь белки в граммах."],
  ["Мощный", "Футболка натягивается на бицепсе."],
  ["Жилистый", "Сила ощущается в каждом движении."],
  ["Крепкий", "Под рубашкой видно работу."],
  ["Подтянутый", "Смотришь в зеркало с одобрением."],
  ["Сложенный", "Дети на пляже просят показать мускулы."],
  ["Прокачанный", "Молодёжь в зале спрашивает совета."],
  ["Сильный", "Жмёшь в полтора своих веса."],
  ["Крепыш", "Двигаешь шкаф один. Без напряжения."],
  ["Боец", "В зале ты как у себя дома."],
  ["Жимовик", "Жим лёжа — твоё призвание."],
  ["Тяговик", "Становая — твоя страсть."],
  ["Силовой атлет", "Готов к соревнованиям."],
  ["Мускулистый", "Спина закрывает половину зеркала."],
  ["Богатырь-стажёр", "Чувствуется потенциал."],
  ["Жим-машина", "Делаешь повторы, как на конвейере."],
  ["Силовик", "Веса, которые тебя пугали, теперь твоя разминка."],
  ["Мощный атлет", "На тебя оборачиваются в зале."],
  ["Богатырь", "Ты — пример для подражания."],
  ["Гора мышц", "Двери становятся узкими."],
  ["Громила", "Стулья жалобно скрипят."],
  ["Танк", "Просто проходишь сквозь толпу."],
  ["Зверь", "Рычишь под штангой. Все молчат."],
  ["Колосс", "Размеры впечатляют даже опытных."],
  ["Глыба", "Тебе уступают дорогу."],
  ["Мастер", "Твоя техника безупречна."],
  ["Профессионал", "Молодёжь смотрит как на легенду."],
  ["Сильнейший", "В твоём зале нет тебе равных."],
  ["Чемпион зала", "Все рекорды — твои."],
  ["Тяжеловес", "Цифры на штанге впечатляют."],
  ["Атлет высшего класса", "Тебя зовут на турниры."],
  ["Силовой эксперт", "Тренеры консультируются у тебя."],
  ["Воин железа", "Каждая тренировка — битва с собой."],
  ["Гранит", "Тебя ничем не пробить."],
  ["Колосс силы", "Ты двигаешь то, что не двигают другие."],
  ["Мифический атлет", "О тебе ходят легенды."],
  ["Легенда зала", "Твоё имя на доске рекордов."],
  ["Великан", "Ты — сила природы."],
  ["Полубог", "Земля дрожит, когда ты ставишь штангу."],
  ["Олимпиец", "Достоин античных мифов."],
  ["Геркулес", "12 подвигов — это твоя разминка."],
  ["Титан", "Способен сдвинуть мир."],
  ["Легенда", "Твоё имя будут помнить века."],
];

// Historical default list — used only on first-run seeding so existing users
// keep level behavior. After seeding, the source of truth is the `is_main`
// column on the exercises table, which the user can edit on the Exercises page.
export const DEFAULT_MAIN_EXERCISE_NAMES = [
  "Жим штанги лёжа",
  "Жим гантелей лёжа",
  "Жим штанги на наклонной скамье",
  "Приседания со штангой",
  "Румынская тяга",
  "Становая тяга",
  "Тяга штанги в наклоне",
  "Тяга гантели одной рукой",
  "Жим штанги стоя",
  "Жим гантелей сидя",
  "Подъём штанги на бицепс",
];

// Per-exercise bodyweight multipliers. For dumbbell movements, the multiplier
// reflects the weight of ONE dumbbell relative to bodyweight (so 0.4 = 40% of
// bodyweight per dumbbell, e.g. an 80 kg trainee aims for ~32 kg dumbbells at
// the anchor level).
export const DEFAULT_MAIN_EXERCISE_MULTIPLIERS: Record<string, number> = {
  "Жим штанги лёжа": 1.0,
  "Жим штанги на наклонной скамье": 0.85,
  "Приседания со штангой": 1.5,
  "Румынская тяга": 1.5,
  "Становая тяга": 2.0,
  "Тяга штанги в наклоне": 1.0,
  "Жим штанги стоя": 0.65,
  "Подъём штанги на бицепс": 0.65,
  "Жим гантелей лёжа": 0.4,
  "Тяга гантели одной рукой": 0.5,
  "Жим гантелей сидя": 0.4,
};

const MAIN_EXERCISES_SEED_KEY = "main_exercises_seeded_v1";
const DEFAULT_MULTIPLIERS_SEED_KEY = "default_multipliers_seeded_v1";
const DEFAULT_EQUIPMENT_SEED_KEY = "default_equipment_seeded_v1";

// Default equipment for the historical exercise catalog. Anything not listed
// here defaults to "other" via the column default, and the user can edit it
// on the /exercises page.
export const DEFAULT_EXERCISE_EQUIPMENT: Record<
  string,
  "barbell" | "dumbbell" | "bodyweight" | "machine" | "other"
> = {
  // Barbell
  "Жим штанги лёжа": "barbell",
  "Жим штанги на наклонной скамье": "barbell",
  "Приседания со штангой": "barbell",
  "Румынская тяга": "barbell",
  "Становая тяга": "barbell",
  "Тяга штанги в наклоне": "barbell",
  "Жим штанги стоя": "barbell",
  "Подъём штанги на бицепс": "barbell",
  "Французский жим": "barbell",
  // Dumbbell
  "Жим гантелей лёжа": "dumbbell",
  "Жим гантелей сидя": "dumbbell",
  "Тяга гантели одной рукой": "dumbbell",
  "Разводка гантелей": "dumbbell",
  "Махи гантелями в стороны": "dumbbell",
  "Махи в наклоне": "dumbbell",
  "Сгибания с гантелями": "dumbbell",
  "Молотки с гантелями": "dumbbell",
  "Выпады с гантелями": "dumbbell",
  // Bodyweight
  "Подтягивания": "bodyweight",
  "Отжимания на брусьях": "bodyweight",
  "Отжимания узким хватом": "bodyweight",
  "Скручивания": "bodyweight",
  "Планка": "bodyweight",
  "Подъём ног в висе": "bodyweight",
  // Machine / cable
  "Жим ногами": "machine",
  "Сгибания ног лёжа": "machine",
  "Разгибания ног сидя": "machine",
  "Тяга верхнего блока": "machine",
  "Тяга горизонтального блока": "machine",
  "Подъёмы на носки": "machine",
  "Разгибания на блоке": "machine",
};

/**
 * One-time seed: marks the historical default 11 names as main so existing
 * users keep the same level behavior. The seed runs only when BOTH:
 *   - no exercise is currently marked is_main = true, AND
 *   - the sentinel row in `app_meta` is absent.
 * The sentinel guarantees that even if the user later unstars every main
 * exercise, a server restart will NOT re-apply the canonical list.
 */
export async function seedMainExercisesIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, MAIN_EXERCISES_SEED_KEY))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(exercisesTable)
    .where(eq(exercisesTable.isMain, true));

  let seededCount = 0;
  if (cnt === 0) {
    const updated = await db
      .update(exercisesTable)
      .set({ isMain: true })
      .where(inArray(exercisesTable.name, DEFAULT_MAIN_EXERCISE_NAMES))
      .returning({ id: exercisesTable.id });
    seededCount = updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: MAIN_EXERCISES_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: appMetaTable.key });

  return { seeded: seededCount };
}

/**
 * One-time seed: stamps the default equipment kind for the historical
 * exercise catalog. Gated by a sentinel so user edits are never clobbered.
 * Custom exercises and unknown names keep the column default ("other").
 */
export async function seedDefaultEquipmentIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, DEFAULT_EQUIPMENT_SEED_KEY))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  let seededCount = 0;
  for (const [name, equipment] of Object.entries(DEFAULT_EXERCISE_EQUIPMENT)) {
    const updated = await db
      .update(exercisesTable)
      .set({ equipment })
      .where(eq(exercisesTable.name, name))
      .returning({ id: exercisesTable.id });
    seededCount += updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: DEFAULT_EQUIPMENT_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: appMetaTable.key });

  return { seeded: seededCount };
}

/**
 * One-time seed: applies default bodyweight multipliers to the historical 11
 * main exercises. Runs once (gated by sentinel) so a user's later edits are
 * never overwritten on restart. Custom or unknown exercises keep the column
 * default (1.0×).
 */
export async function seedDefaultMultipliersIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, DEFAULT_MULTIPLIERS_SEED_KEY))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  let seededCount = 0;
  for (const [name, mul] of Object.entries(DEFAULT_MAIN_EXERCISE_MULTIPLIERS)) {
    const updated = await db
      .update(exercisesTable)
      .set({ bodyweightMultiplier: mul.toFixed(2) })
      .where(eq(exercisesTable.name, name))
      .returning({ id: exercisesTable.id });
    seededCount += updated.length;
  }

  await db
    .insert(appMetaTable)
    .values({
      key: DEFAULT_MULTIPLIERS_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: appMetaTable.key });

  return { seeded: seededCount };
}

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function levelFactor(level: number): number {
  if (level <= 0) return 0;
  return level / LEVEL_FACTOR_ANCHOR;
}

/**
 * Reference weight at this level for a 1.0× exercise = bodyweight × levelFactor.
 * This replaces the old single-number `benchmarkKg` and is what programs.ts
 * uses as a base when no PR is available for an exercise.
 */
export function referenceKg(level: number, bodyWeightKg: number): number {
  if (level <= 0) return 0;
  return roundTo(bodyWeightKg * levelFactor(level), 2.5);
}

// Smallest plate increment we use for required weights and the practical floor
// for any positive multiplier. Without this floor, very low multipliers at low
// levels would round to 0 kg, which both looks wrong in the UI and would
// trivially count as "passed" for any user.
const MIN_REQUIRED_KG = 2.5;

/**
 * Required weight for a specific main exercise at a given level, given the
 * user's bodyweight, the exercise's per-exercise multiplier, and an optional
 * jump penalty multiplier (≥ 1). Floored at MIN_REQUIRED_KG when multiplier > 0
 * so early levels remain meaningful.
 */
export function requiredKgForExercise(
  level: number,
  bodyWeightKg: number,
  multiplier: number,
  penaltyMultiplier: number = 1,
): number {
  if (level <= 0 || multiplier <= 0) return 0;
  const raw = bodyWeightKg * levelFactor(level) * multiplier * penaltyMultiplier;
  return Math.max(MIN_REQUIRED_KG, roundTo(raw, 2.5));
}

/**
 * Required tonnage (kg) per 7-day window to qualify for a given level.
 * Formula: 3 workouts/week × 5 exercises × 5 sets × 9 reps × workingWeight,
 * where workingWeight = bodyWeight × levelFactor(level). Multiplied by an
 * optional jump-penalty multiplier (≥ 1) when computing penalised targets.
 */
export function tonnage7dRequired(
  level: number,
  bodyWeightKg: number,
  penaltyMultiplier: number = 1,
): number {
  if (level <= 0) return 0;
  const workingWeight = bodyWeightKg * levelFactor(level);
  const weekly =
    WORKOUTS_PER_WEEK_ASSUMED *
    EXERCISES_PER_WORKOUT *
    SETS_PER_EXERCISE *
    REPS_PER_SET *
    workingWeight *
    penaltyMultiplier;
  return roundTo(weekly, 500);
}

/**
 * Computes the jump penalty multiplier for a candidate level relative to the
 * confirmed level. +1 jump = ×1.0 (no penalty). Each additional level adds
 * +10%. Always ≥ 1.
 */
export function jumpPenaltyMultiplier(
  candidateLevel: number,
  confirmedLevel: number,
): number {
  const jump = candidateLevel - confirmedLevel;
  if (jump <= 1) return 1;
  return 1 + JUMP_PENALTY_PER_LEVEL * (jump - 1);
}

export function buildLevels(bodyWeightKg: number): LevelDef[] {
  return NAMES_AND_DESCRIPTIONS.map(([name, description], idx) => ({
    level: idx,
    name,
    description,
    tier: Math.min(8, Math.floor(idx / TIER_SIZE)),
    benchmarkKg: referenceKg(idx, bodyWeightKg),
    tonnage7dKgRequired: tonnage7dRequired(idx, bodyWeightKg),
    mainExercisesRequired: idx === 0 ? 0 : MAIN_EXERCISES_REQUIRED,
    rank: rankForLevel(idx),
  }));
}

// Default ladder built with the fallback bodyweight — exposed for callers
// that don't (yet) need a per-user computation.
export const LEVELS: LevelDef[] = buildLevels(FALLBACK_BODY_WEIGHT_KG);

export const MAX_LEVEL = LEVELS.length - 1;

export type Equipment = "barbell" | "dumbbell" | "bodyweight" | "machine" | "other";
export type AutoPassedReason = "below_bar_weight" | "time_based_exercise";

export type MainExerciseStat = {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  equipment: Equipment;
  maxWeightKg: number;
  /** Effective multiplier = mcKg / bodyWeightKg. Used by the level-detail dialog
   *  to compute required kg for any level: bodyWeight × (level/anchor) × multiplier. */
  multiplier: number;
  requiredKgForNextLevel: number | null;
  // ≥ 1. When > 1, the requirement above already includes the jump penalty.
  requiredKgPenaltyMultiplier: number;
  // When non-null, the exercise is treated as passed regardless of maxWeightKg.
  // "below_bar_weight" — barbell exercise whose required kg < empty bar.
  // "time_based_exercise" — e.g. Планка; kg requirement not applicable.
  autoPassedReason: AutoPassedReason | null;
  /** MS-equivalent kg target for this exercise and the user's weight class.
   *  Null for time-based exercises (e.g. Планка). */
  mcKg: number | null;
  /** How the mcKg was derived. */
  mcSource: McSource;
};

export type LevelStats = {
  currentTonnage7dKg: number;
  maxTonnage7dKg: number;
  oldestSetInWindowAt: string | null;
  mainExercises: MainExerciseStat[];
};

export type CurrentLevelInfo = {
  currentLevel: number;
  bestLevelEver: number;
  nextLevel: number | null;
  // The user's last persisted level — anchor for the jump penalty. Equals
  // currentLevel after a successful level-up has been persisted.
  confirmedLevel: number;
  // Penalty multiplier applied to the next level's tonnage and per-exercise
  // requirements. ≥ 1; equals 1 when the next level is just confirmed+1.
  nextLevelPenaltyMultiplier: number;
  // Effective tonnage target the user actually has to hit to qualify for the
  // next level (penalty applied, rounded the same way the server does it
  // internally). Null at max level. Surfaced so all UIs agree with the
  // backend's pass check at the rounding boundary.
  nextLevelTonnage7dKgRequired: number | null;
  bodyWeightKg: number;
  bodyWeightIsFallback: boolean;
  // Constants exposed to the client so the level-detail dialog can compute
  // per-exercise required kg for arbitrary levels without re-implementing
  // the formula in three places.
  barWeightKg: number;
  levelFactorAnchor: number;
  /**
   * Sport rank based on the user's actual max-weight-to-MC ratio averaged
   * across main exercises with recorded data. Falls back to rankForLevel
   * when no exercises have logged sets.
   */
  currentRank: SportRank;
  /** Official competition weight class for the user's bodyweight. */
  weightClassKg: number;
  /** Athlete sex used to select the MS standards table. */
  sex: "male" | "female";
  /**
   * True when confirmed_level > computed currentLevel. Indicates the norms
   * were recalibrated and the user's effective targets increased; UI should
   * show a "check your maxes" hint.
   */
  confirmedLevelMigrationNeeded: boolean;
  levels: LevelDef[];
  stats: LevelStats;
};

export async function computeCurrentLevel(): Promise<CurrentLevelInfo> {
  const profile = await getProfile();
  const bodyWeightKg = profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
  const bodyWeightIsFallback = profile.bodyWeightKg == null;
  const sex = profile.sex ?? FALLBACK_SEX;
  const levels = buildLevels(bodyWeightKg);

  const mainRows = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      bodyweightMultiplier: exercisesTable.bodyweightMultiplier,
      equipment: exercisesTable.equipment,
    })
    .from(exercisesTable)
    .where(eq(exercisesTable.isMain, true))
    .orderBy(asc(exercisesTable.muscleGroup), asc(exercisesTable.name));

  // Pre-compute MC-based effective multipliers for each main exercise.
  // effectiveMul[id] = mcKg / bodyWeightKg  (→ required = bw × level/80 × mul = mcKg × level/80)
  // For time-based exercises (Планка), mcKg is null and the exercise is auto-passed.
  const mcResultByExercise = new Map<number, { kg: number | null; source: McSource; effectiveMul: number }>();
  for (const r of mainRows) {
    const fallbackMul = Number(r.bodyweightMultiplier);
    const result = getMcKgForExercise(r.name, bodyWeightKg, sex, fallbackMul);
    const effectiveMul = result.kg != null ? result.kg / bodyWeightKg : 0;
    mcResultByExercise.set(r.id, { kg: result.kg, source: result.source, effectiveMul });
  }

  const mainIds = mainRows.map((r) => r.id);
  const maxByExercise = new Map<number, number>();

  if (mainIds.length > 0) {
    const sets = await db
      .select({
        exerciseId: workoutSetsTable.exerciseId,
        weightKg: workoutSetsTable.weightKg,
      })
      .from(workoutSetsTable)
      .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
      .where(
        and(
          isNotNull(workoutsTable.finishedAt),
          inArray(workoutSetsTable.exerciseId, mainIds),
        ),
      );

    for (const s of sets) {
      const w = Number(s.weightKg);
      const prev = maxByExercise.get(s.exerciseId) ?? 0;
      if (w > prev) maxByExercise.set(s.exerciseId, w);
    }
  }

  const allSets = await db
    .select({
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      createdAt: workoutSetsTable.createdAt,
    })
    .from(workoutSetsTable)
    .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
    .where(isNotNull(workoutsTable.finishedAt))
    .orderBy(asc(workoutSetsTable.createdAt));

  const events = allSets.map((s) => ({
    ts: s.createdAt.getTime(),
    volume: Number(s.weightKg) * s.reps,
  }));

  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  let currentTonnage7dKg = 0;
  let oldestSetInWindowTs: number | null = null;
  for (const e of events) {
    if (e.ts >= windowStart && e.ts <= now) {
      currentTonnage7dKg += e.volume;
      if (oldestSetInWindowTs === null || e.ts < oldestSetInWindowTs) {
        oldestSetInWindowTs = e.ts;
      }
    }
  }

  const maxTonnage7dKg = computeMaxRollingTonnage(events, windowMs);

  // Pass-check helpers. `penaltyMul` allows a candidate level beyond
  // `confirmed + 1` to charge an extra fee on both tonnage and per-exercise
  // weight requirements.
  function levelPasses(
    lvl: LevelDef,
    tonnage: number,
    penaltyMul: number,
  ): boolean {
    if (lvl.level === 0) return true;
    let passedExercises = 0;
    for (const r of mainRows) {
      const mc = mcResultByExercise.get(r.id)!;
      // Time-based exercises (e.g. Планка) have no kg requirement — auto-pass.
      if (mc.kg == null) {
        passedExercises += 1;
        continue;
      }
      const req = requiredKgForExercise(lvl.level, bodyWeightKg, mc.effectiveMul, penaltyMul);
      // Barbell exercises can't physically be loaded below the empty bar, so a
      // sub-bar requirement is auto-passed (counts toward the threshold).
      if (req > 0 && r.equipment === "barbell" && req < BAR_WEIGHT_KG) {
        passedExercises += 1;
        continue;
      }
      const cur = maxByExercise.get(r.id) ?? 0;
      if (cur >= req && req > 0) passedExercises += 1;
    }
    if (passedExercises < lvl.mainExercisesRequired) return false;
    const tonnageRequired = tonnage7dRequired(
      lvl.level,
      bodyWeightKg,
      penaltyMul,
    );
    return tonnage >= tonnageRequired;
  }

  // bestLevelEver — historical max, computed without the jump penalty.
  let bestLevelEver = 0;
  for (const lvl of levels) {
    if (levelPasses(lvl, maxTonnage7dKg, 1)) {
      bestLevelEver = lvl.level;
    } else {
      break;
    }
  }

  // Bootstrap the confirmed-level sentinel for new installs / pre-existing
  // users. Without this, a user with significant history would suddenly drop
  // to level 0 because the penalty against confirmed=0 makes level 1 unreachable.
  let confirmedLevel = await getConfirmedLevel();
  if (confirmedLevel === null) {
    confirmedLevel = bestLevelEver;
    await setConfirmedLevel(confirmedLevel);
  }

  // currentLevel — bounded above by confirmed + ladder length, with each step
  // beyond confirmed + 1 charged the jump penalty.
  let currentLevel = 0;
  for (const lvl of levels) {
    const penaltyMul = jumpPenaltyMultiplier(lvl.level, confirmedLevel);
    if (levelPasses(lvl, currentTonnage7dKg, penaltyMul)) {
      currentLevel = lvl.level;
    } else {
      break;
    }
  }

  // Persist the new floor when the user has earned a higher level.
  if (currentLevel > confirmedLevel) {
    await setConfirmedLevel(currentLevel);
    confirmedLevel = currentLevel;
  }

  const nextLevelIdx = currentLevel >= MAX_LEVEL ? null : currentLevel + 1;
  const nextLvl = nextLevelIdx !== null ? levels[nextLevelIdx]! : null;
  const nextLevelPenaltyMultiplier =
    nextLvl !== null ? jumpPenaltyMultiplier(nextLvl.level, confirmedLevel) : 1;
  const nextLevelTonnage7dKgRequired = nextLvl
    ? tonnage7dRequired(nextLvl.level, bodyWeightKg, nextLevelPenaltyMultiplier)
    : null;

  const mainExercises: MainExerciseStat[] = mainRows.map((r) => {
    const mc = mcResultByExercise.get(r.id)!;
    // Time-based exercises (e.g. Планка) have no kg requirement at all.
    const isTimeBased = mc.kg == null;
    const required = !isTimeBased && nextLvl
      ? requiredKgForExercise(
          nextLvl.level,
          bodyWeightKg,
          mc.effectiveMul,
          nextLevelPenaltyMultiplier,
        )
      : null;
    let autoPassedReason: AutoPassedReason | null = null;
    if (isTimeBased) {
      autoPassedReason = "time_based_exercise";
    } else if (
      required != null &&
      required > 0 &&
      r.equipment === "barbell" &&
      required < BAR_WEIGHT_KG
    ) {
      autoPassedReason = "below_bar_weight";
    }
    return {
      exerciseId: r.id,
      name: r.name,
      muscleGroup: r.muscleGroup,
      equipment: r.equipment as Equipment,
      maxWeightKg: round(maxByExercise.get(r.id) ?? 0),
      multiplier: round(mc.effectiveMul),
      requiredKgForNextLevel: required,
      requiredKgPenaltyMultiplier: round(nextLevelPenaltyMultiplier),
      autoPassedReason,
      mcKg: mc.kg != null ? round(mc.kg) : null,
      mcSource: mc.source,
    };
  });

  // Compute currentRank from the user's actual big-3 performance (squat,
  // bench, deadlift) as a fraction of their MC target. Only classic lifts are
  // used so that accessory PRs don't inflate the displayed rank.
  // Falls back to level-based rank when no classic lifts have logged sets.
  const CLASSIC_NAMES = new Set([
    "Приседания со штангой",
    "Жим штанги лёжа",
    "Становая тяга",
  ]);
  const classicWithData = mainRows.filter((r) => {
    const mc = mcResultByExercise.get(r.id)!;
    return (
      CLASSIC_NAMES.has(r.name) &&
      mc.kg != null &&
      (maxByExercise.get(r.id) ?? 0) > 0
    );
  });
  let currentRank: SportRank;
  if (classicWithData.length > 0) {
    const totalRatio = classicWithData.reduce((sum, r) => {
      const mc = mcResultByExercise.get(r.id)!;
      const maxW = maxByExercise.get(r.id) ?? 0;
      return sum + maxW / mc.kg!;
    }, 0);
    const avgRatio = totalRatio / classicWithData.length;
    currentRank = rankForMcPercent(round(avgRatio, 4));
  } else {
    // No big-3 data → fall back to level-based rank
    currentRank = rankForLevel(currentLevel);
  }

  // Guard: if the stored confirmed level is higher than the freshly computed
  // level (e.g. after a norm recalibration made targets harder), use the
  // confirmed level as the floor for display. We still show a banner so the
  // user knows the norms changed and they should re-verify their maxes.
  const confirmedLevelMigrationNeeded = confirmedLevel > currentLevel;
  const effectiveCurrentLevel = confirmedLevelMigrationNeeded
    ? confirmedLevel
    : currentLevel;

  return {
    // Use effectiveCurrentLevel as the floor: when confirmed > computed (e.g.
    // after norm recalibration), we don't visually demote the user.
    currentLevel: effectiveCurrentLevel,
    bestLevelEver,
    nextLevel: effectiveCurrentLevel >= MAX_LEVEL ? null : effectiveCurrentLevel + 1,
    confirmedLevel,
    nextLevelPenaltyMultiplier: round(nextLevelPenaltyMultiplier),
    nextLevelTonnage7dKgRequired,
    bodyWeightKg,
    bodyWeightIsFallback,
    barWeightKg: BAR_WEIGHT_KG,
    levelFactorAnchor: LEVEL_FACTOR_ANCHOR,
    currentRank,
    weightClassKg: getWeightClassKg(bodyWeightKg, sex),
    sex,
    confirmedLevelMigrationNeeded,
    levels,
    stats: {
      currentTonnage7dKg: round(currentTonnage7dKg),
      maxTonnage7dKg: round(maxTonnage7dKg),
      oldestSetInWindowAt:
        oldestSetInWindowTs !== null
          ? new Date(oldestSetInWindowTs).toISOString()
          : null,
      mainExercises,
    },
  };
}

function computeMaxRollingTonnage(
  events: Array<{ ts: number; volume: number }>,
  windowMs: number,
): number {
  if (events.length === 0) return 0;
  let best = 0;
  let sum = 0;
  let left = 0;
  for (let right = 0; right < events.length; right++) {
    sum += events[right].volume;
    while (left <= right && events[right].ts - events[left].ts > windowMs) {
      sum -= events[left].volume;
      left++;
    }
    if (sum > best) best = sum;
  }
  return best;
}
