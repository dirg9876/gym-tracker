import { db, exercisesTable, workoutSetsTable, workoutsTable, appMetaTable } from "@workspace/db";
import { eq, and, isNotNull, asc, inArray, sql } from "drizzle-orm";

export type LevelDef = {
  level: number;
  name: string;
  description: string;
  tier: number;
  benchmarkKg: number;
  tonnage30dKgRequired: number;
  mainExercisesRequired: number;
};

const TIER_SIZE = 9;
const MAIN_EXERCISES_REQUIRED = 3;
const WORKOUTS_PER_MONTH_ASSUMED = 6;
const SETS_PER_EXERCISE = 4;
const REPS_PER_SET = 8;
const EXERCISES_PER_WORKOUT = 5;
const AVG_WEIGHT_FACTOR = 0.7;

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

const MAIN_EXERCISES_SEED_KEY = "main_exercises_seeded_v1";

/**
 * One-time seed: marks the historical default 11 names as main so existing
 * users keep the same level behavior. Guarded by a sentinel row in
 * `app_meta` so this runs at most once per database — even if the user
 * later unstars every main exercise, a server restart will NOT re-apply
 * the canonical list.
 */
export async function seedMainExercisesIfEmpty(): Promise<{ seeded: number }> {
  const sentinel = await db
    .select({ key: appMetaTable.key })
    .from(appMetaTable)
    .where(eq(appMetaTable.key, MAIN_EXERCISES_SEED_KEY))
    .limit(1);
  if (sentinel.length > 0) return { seeded: 0 };

  const updated = await db
    .update(exercisesTable)
    .set({ isMain: true })
    .where(inArray(exercisesTable.name, DEFAULT_MAIN_EXERCISE_NAMES))
    .returning({ id: exercisesTable.id });

  await db
    .insert(appMetaTable)
    .values({
      key: MAIN_EXERCISES_SEED_KEY,
      value: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: appMetaTable.key });

  return { seeded: updated.length };
}

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function benchmarkKg(level: number): number {
  if (level <= 0) return 0;
  const raw = 20 + (level - 1) * (180 / 79);
  return roundTo(raw, 2.5);
}

function tonnageKg(level: number): number {
  if (level <= 0) return 0;
  const perWorkout =
    EXERCISES_PER_WORKOUT * SETS_PER_EXERCISE * REPS_PER_SET * benchmarkKg(level) * AVG_WEIGHT_FACTOR;
  const monthly = perWorkout * WORKOUTS_PER_MONTH_ASSUMED;
  return roundTo(monthly, 500);
}

export const LEVELS: LevelDef[] = NAMES_AND_DESCRIPTIONS.map(([name, description], idx) => ({
  level: idx,
  name,
  description,
  tier: Math.min(8, Math.floor(idx / TIER_SIZE)),
  benchmarkKg: benchmarkKg(idx),
  tonnage30dKgRequired: tonnageKg(idx),
  mainExercisesRequired: idx === 0 ? 0 : MAIN_EXERCISES_REQUIRED,
}));

export const MAX_LEVEL = LEVELS.length - 1;

export type MainExerciseStat = {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  maxWeightKg: number;
};

export type LevelStats = {
  currentTonnage30dKg: number;
  maxTonnage30dKg: number;
  oldestSetInWindowAt: string | null;
  mainExercises: MainExerciseStat[];
};

export type CurrentLevelInfo = {
  currentLevel: number;
  bestLevelEver: number;
  nextLevel: number | null;
  stats: LevelStats;
};

export async function computeCurrentLevel(): Promise<CurrentLevelInfo> {
  const mainRows = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
    })
    .from(exercisesTable)
    .where(eq(exercisesTable.isMain, true))
    .orderBy(asc(exercisesTable.muscleGroup), asc(exercisesTable.name));

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

  const mainExercises: MainExerciseStat[] = mainRows.map((r) => ({
    exerciseId: r.id,
    name: r.name,
    muscleGroup: r.muscleGroup,
    maxWeightKg: round(maxByExercise.get(r.id) ?? 0),
  }));

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

  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  let currentTonnage30dKg = 0;
  let oldestSetInWindowTs: number | null = null;
  for (const e of events) {
    if (e.ts >= windowStart && e.ts <= now) {
      currentTonnage30dKg += e.volume;
      if (oldestSetInWindowTs === null || e.ts < oldestSetInWindowTs) {
        oldestSetInWindowTs = e.ts;
      }
    }
  }

  const maxTonnage30dKg = computeMaxRollingTonnage(events, windowMs);

  function levelPasses(lvl: LevelDef, tonnage: number): boolean {
    const passedExercises = mainExercises.filter(
      (e) => e.maxWeightKg >= lvl.benchmarkKg,
    ).length;
    return (
      passedExercises >= lvl.mainExercisesRequired &&
      tonnage >= lvl.tonnage30dKgRequired
    );
  }

  let currentLevel = 0;
  for (const lvl of LEVELS) {
    if (levelPasses(lvl, currentTonnage30dKg)) {
      currentLevel = lvl.level;
    } else {
      break;
    }
  }

  let bestLevelEver = 0;
  for (const lvl of LEVELS) {
    if (levelPasses(lvl, maxTonnage30dKg)) {
      bestLevelEver = lvl.level;
    } else {
      break;
    }
  }

  const nextLevel = currentLevel >= MAX_LEVEL ? null : currentLevel + 1;

  return {
    currentLevel,
    bestLevelEver,
    nextLevel,
    stats: {
      currentTonnage30dKg: round(currentTonnage30dKg),
      maxTonnage30dKg: round(maxTonnage30dKg),
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
