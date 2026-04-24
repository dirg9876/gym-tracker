import { db, exercisesTable, workoutSetsTable, workoutsTable } from "@workspace/db";
import { eq, and, isNotNull, asc } from "drizzle-orm";

export type LevelDef = {
  level: number;
  name: string;
  description: string;
  tier: number;
  benchKgRequired: number;
  tonnage30dKgRequired: number;
};

const TIER_SIZE = 9;

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

function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function benchRequired(level: number): number {
  if (level <= 0) return 0;
  const raw = 20 + (level - 1) * (180 / 79);
  return roundTo(raw, 2.5);
}

function tonnageRequired(level: number): number {
  if (level <= 0) return 0;
  return roundTo(level * 250, 50);
}

export const LEVELS: LevelDef[] = NAMES_AND_DESCRIPTIONS.map(([name, description], idx) => ({
  level: idx,
  name,
  description,
  tier: Math.min(8, Math.floor(idx / TIER_SIZE)),
  benchKgRequired: benchRequired(idx),
  tonnage30dKgRequired: tonnageRequired(idx),
}));

export const MAX_LEVEL = LEVELS.length - 1;

const BENCH_EXERCISE_NAME = "Жим штанги лёжа";

export type LevelStats = {
  maxBenchKg: number;
  maxTonnage30dKg: number;
  benchExerciseId: number | null;
  benchExerciseName: string;
};

export type CurrentLevelInfo = {
  currentLevel: number;
  nextLevel: number | null;
  stats: LevelStats;
};

export async function computeCurrentLevel(): Promise<CurrentLevelInfo> {
  const benchRow = (
    await db
      .select({ id: exercisesTable.id, name: exercisesTable.name })
      .from(exercisesTable)
      .where(eq(exercisesTable.name, BENCH_EXERCISE_NAME))
      .limit(1)
  )[0];

  const benchExerciseId = benchRow?.id ?? null;
  const benchExerciseName = benchRow?.name ?? BENCH_EXERCISE_NAME;

  let maxBenchKg = 0;
  if (benchExerciseId !== null) {
    const benchSets = await db
      .select({ weightKg: workoutSetsTable.weightKg })
      .from(workoutSetsTable)
      .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
      .where(
        and(
          eq(workoutSetsTable.exerciseId, benchExerciseId),
          isNotNull(workoutsTable.finishedAt),
        ),
      );
    for (const s of benchSets) {
      const w = Number(s.weightKg);
      if (w > maxBenchKg) maxBenchKg = w;
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

  const maxTonnage30dKg = computeMaxRollingTonnage(
    allSets.map((s) => ({
      ts: s.createdAt.getTime(),
      volume: Number(s.weightKg) * s.reps,
    })),
    30 * 24 * 60 * 60 * 1000,
  );

  let currentLevel = 0;
  for (const lvl of LEVELS) {
    if (
      maxBenchKg >= lvl.benchKgRequired &&
      maxTonnage30dKg >= lvl.tonnage30dKgRequired
    ) {
      currentLevel = lvl.level;
    } else {
      break;
    }
  }

  const nextLevel = currentLevel >= MAX_LEVEL ? null : currentLevel + 1;

  return {
    currentLevel,
    nextLevel,
    stats: {
      maxBenchKg: round(maxBenchKg),
      maxTonnage30dKg: round(maxTonnage30dKg),
      benchExerciseId,
      benchExerciseName,
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
