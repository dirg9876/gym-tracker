import {
  db,
  exercisesTable,
  workoutSetsTable,
  workoutsTable,
  customProgramsTable,
  customProgramExercisesTable,
} from "@workspace/db";
import { and, asc, eq, isNotNull, inArray, or } from "drizzle-orm";
import { computeCurrentLevel, LEVELS, MAX_LEVEL, referenceKg, levelFactor } from "./levels";
import { getMcKgForExercise } from "./sport-norms";

export type Intent = "strength" | "hypertrophy" | "accessory";

export type ProgramExerciseDef = {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  intent: Intent;
  note?: string;
};

export type ProgramDef = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  exercises: ProgramExerciseDef[];
};

export const PROGRAMS: ProgramDef[] = [
  {
    id: "chest",
    name: "День груди",
    description: "Жимовая тренировка с акцентом на грудные. Силовой жим + гипертрофия.",
    emoji: "💪",
    exercises: [
      { name: "Жим штанги лёжа", sets: 4, repsMin: 5, repsMax: 6, intent: "strength", note: "Главное упражнение — жми тяжело и чисто." },
      { name: "Жим штанги на наклонной скамье", sets: 4, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Жим гантелей лёжа", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Отжимания на брусьях", sets: 3, repsMin: 8, repsMax: 12, intent: "hypertrophy", note: "С весом, если можешь." },
      { name: "Разводка гантелей", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory", note: "Растягивай в нижней точке." },
    ],
  },
  {
    id: "back",
    name: "День спины",
    description: "Тяги во всех плоскостях. Толстая спина и сильный хват.",
    emoji: "🦾",
    exercises: [
      { name: "Становая тяга", sets: 4, repsMin: 5, repsMax: 5, intent: "strength", note: "Спина прямая, штанга у голени." },
      { name: "Подтягивания", sets: 4, repsMin: 6, repsMax: 10, intent: "hypertrophy", note: "До касания подбородком грифа." },
      { name: "Тяга штанги в наклоне", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Тяга гантели одной рукой", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Тяга верхнего блока", sets: 3, repsMin: 10, repsMax: 12, intent: "accessory", note: "Своди лопатки в нижней точке." },
    ],
  },
  {
    id: "legs",
    name: "День ног",
    description: "Тяжёлый сплит на квадрицепс, бицепс бедра и икры.",
    emoji: "🦵",
    exercises: [
      { name: "Приседания со штангой", sets: 4, repsMin: 5, repsMax: 6, intent: "strength", note: "Глубже параллели, спина прямая." },
      { name: "Румынская тяга", sets: 4, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Жим ногами", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Выпады с гантелями", sets: 3, repsMin: 10, repsMax: 12, intent: "accessory", note: "На каждую ногу." },
      { name: "Сгибания ног лёжа", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory" },
      { name: "Подъёмы на носки", sets: 4, repsMin: 12, repsMax: 15, intent: "accessory" },
    ],
  },
  {
    id: "shoulders",
    name: "День плеч",
    description: "Жимы и махи во всех плоскостях для широких плеч.",
    emoji: "🪨",
    exercises: [
      { name: "Жим штанги стоя", sets: 4, repsMin: 5, repsMax: 6, intent: "strength", note: "Корпус жёсткий, никакого читинга." },
      { name: "Жим гантелей сидя", sets: 4, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Махи гантелями в стороны", sets: 4, repsMin: 12, repsMax: 15, intent: "accessory", note: "Контролируй опускание." },
      { name: "Махи в наклоне", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory" },
      { name: "Жим штанги на наклонной скамье", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy", note: "Добивка для верха груди и переднего пучка." },
    ],
  },
  {
    id: "arms",
    name: "День рук",
    description: "Бицепс и трицепс — суперсеты, выжимаем максимум.",
    emoji: "🍗",
    exercises: [
      { name: "Подъём штанги на бицепс", sets: 4, repsMin: 6, repsMax: 8, intent: "strength" },
      { name: "Французский жим", sets: 4, repsMin: 6, repsMax: 8, intent: "strength" },
      { name: "Сгибания с гантелями", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Разгибания на блоке", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Молотки с гантелями", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory", note: "Брахиалис и предплечья." },
      { name: "Отжимания узким хватом", sets: 3, repsMin: 8, repsMax: 12, intent: "accessory" },
    ],
  },
  {
    id: "push",
    name: "Push: Грудь + Плечи + Трицепс",
    description: "Все жимовые группы за одну тренировку.",
    emoji: "🚀",
    exercises: [
      { name: "Жим штанги лёжа", sets: 4, repsMin: 5, repsMax: 6, intent: "strength" },
      { name: "Жим штанги стоя", sets: 4, repsMin: 6, repsMax: 8, intent: "hypertrophy" },
      { name: "Жим штанги на наклонной скамье", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Махи гантелями в стороны", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory" },
      { name: "Французский жим", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Разгибания на блоке", sets: 3, repsMin: 10, repsMax: 12, intent: "accessory" },
    ],
  },
  {
    id: "pull",
    name: "Pull: Спина + Бицепс",
    description: "Тяги и сгибания — задний ряд мышц.",
    emoji: "🪝",
    exercises: [
      { name: "Становая тяга", sets: 4, repsMin: 5, repsMax: 5, intent: "strength" },
      { name: "Подтягивания", sets: 4, repsMin: 6, repsMax: 10, intent: "hypertrophy" },
      { name: "Тяга штанги в наклоне", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Тяга гантели одной рукой", sets: 3, repsMin: 10, repsMax: 12, intent: "hypertrophy" },
      { name: "Подъём штанги на бицепс", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Молотки с гантелями", sets: 3, repsMin: 12, repsMax: 15, intent: "accessory" },
    ],
  },
  {
    id: "fullbody",
    name: "Всё тело",
    description: "Все большие группы мышц за одну тренировку. Хорош в начале пути.",
    emoji: "🔥",
    exercises: [
      { name: "Приседания со штангой", sets: 4, repsMin: 5, repsMax: 6, intent: "strength" },
      { name: "Жим штанги лёжа", sets: 4, repsMin: 5, repsMax: 6, intent: "strength" },
      { name: "Тяга штанги в наклоне", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Жим штанги стоя", sets: 3, repsMin: 8, repsMax: 10, intent: "hypertrophy" },
      { name: "Подъём штанги на бицепс", sets: 3, repsMin: 10, repsMax: 12, intent: "accessory" },
      { name: "Скручивания", sets: 3, repsMin: 15, repsMax: 20, intent: "accessory" },
    ],
  },
];

const INTENT_FACTOR: Record<Intent, number> = {
  strength: 0.8,
  hypertrophy: 0.7,
  accessory: 0.6,
};

const EXERCISE_BENCHMARK_FACTOR: Record<string, number> = {
  "Жим штанги лёжа": 1.0,
  "Жим гантелей лёжа": 0.4,
  "Жим штанги на наклонной скамье": 0.85,
  "Разводка гантелей": 0.18,
  "Отжимания на брусьях": 0.5,
  "Приседания со штангой": 1.2,
  "Жим ногами": 2.0,
  "Румынская тяга": 1.1,
  "Выпады с гантелями": 0.3,
  "Сгибания ног лёжа": 0.5,
  "Разгибания ног сидя": 0.6,
  "Подъёмы на носки": 1.0,
  "Становая тяга": 1.4,
  "Подтягивания": 0.0,
  "Тяга штанги в наклоне": 0.85,
  "Тяга гантели одной рукой": 0.35,
  "Тяга верхнего блока": 0.7,
  "Тяга горизонтального блока": 0.7,
  "Жим штанги стоя": 0.6,
  "Жим гантелей сидя": 0.25,
  "Махи гантелями в стороны": 0.12,
  "Махи в наклоне": 0.1,
  "Подъём штанги на бицепс": 0.4,
  "Сгибания с гантелями": 0.18,
  "Молотки с гантелями": 0.18,
  "Французский жим": 0.4,
  "Разгибания на блоке": 0.4,
  "Отжимания узким хватом": 0.0,
  "Скручивания": 0.0,
  "Планка": 0.0,
  "Подъём ног в висе": 0.0,
};

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export type PlannedExercise = {
  exerciseId: number;
  name: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  intent: Intent;
  suggestedWeightKg: number;
  isBodyweight: boolean;
  equipment: "barbell" | "dumbbell" | "bodyweight" | "machine" | "other";
  basedOn: "personal-record" | "level-benchmark";
  note: string | null;
};

export type ProgramPlan = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  basedOnLevel: number;
  basedOnLevelName: string;
  benchmarkKg: number;
  isCustom: boolean;
  exercises: PlannedExercise[];
};

export type ProgramListItem = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  exerciseCount: number;
  isCustom: boolean;
};

export async function listPrograms(userId: string = ""): Promise<ProgramListItem[]> {
  const builtIn: ProgramListItem[] = PROGRAMS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    emoji: p.emoji,
    exerciseCount: p.exercises.length,
    isCustom: false,
  }));

  if (!userId) return builtIn;

  const customRows = await db
    .select({
      id: customProgramsTable.id,
      name: customProgramsTable.name,
      description: customProgramsTable.description,
    })
    .from(customProgramsTable)
    .where(eq(customProgramsTable.userId, userId))
    .orderBy(asc(customProgramsTable.createdAt));

  if (customRows.length === 0) return builtIn;

  const customIds = customRows.map((r) => r.id);
  const exerciseCounts = await db
    .select({ programId: customProgramExercisesTable.programId })
    .from(customProgramExercisesTable)
    .where(inArray(customProgramExercisesTable.programId, customIds));

  const countByProgramId = new Map<number, number>();
  for (const r of exerciseCounts) {
    countByProgramId.set(r.programId, (countByProgramId.get(r.programId) ?? 0) + 1);
  }

  const custom: ProgramListItem[] = customRows.map((r) => ({
    id: String(r.id),
    name: r.name,
    description: r.description,
    emoji: "⚡",
    exerciseCount: countByProgramId.get(r.id) ?? 0,
    isCustom: true,
  }));

  return [...builtIn, ...custom];
}

export type CreateCustomProgramExerciseInput = {
  exerciseId: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  intent: Intent;
  note?: string | null;
};

export type CreateCustomProgramInput = {
  name: string;
  description?: string;
  exercises: CreateCustomProgramExerciseInput[];
};

export async function createCustomProgram(
  userId: string,
  input: CreateCustomProgramInput,
): Promise<ProgramListItem> {
  const [program] = await db
    .insert(customProgramsTable)
    .values({
      userId,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
    })
    .returning();

  if (!program) throw new Error("Failed to create program");

  if (input.exercises.length > 0) {
    await db.insert(customProgramExercisesTable).values(
      input.exercises.map((ex, idx) => ({
        programId: program.id,
        exerciseId: ex.exerciseId,
        sortOrder: idx,
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        intent: ex.intent,
        note: ex.note ?? null,
      })),
    );
  }

  return {
    id: String(program.id),
    name: program.name,
    description: program.description,
    emoji: "⚡",
    exerciseCount: input.exercises.length,
    isCustom: true,
  };
}

export async function deleteCustomProgram(
  programId: string,
  userId: string,
): Promise<{ status: "deleted" | "not_found" | "forbidden" }> {
  const numericId = Number(programId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { status: "forbidden" };
  }
  const [row] = await db
    .select({ id: customProgramsTable.id, userId: customProgramsTable.userId })
    .from(customProgramsTable)
    .where(eq(customProgramsTable.id, numericId));
  if (!row) return { status: "not_found" };
  if (row.userId !== userId) return { status: "forbidden" };
  await db.delete(customProgramsTable).where(eq(customProgramsTable.id, numericId));
  return { status: "deleted" };
}

async function buildPlanFromExerciseDefs(
  programId: string,
  name: string,
  description: string,
  emoji: string,
  isCustom: boolean,
  exerciseDefs: Array<{
    name: string;
    exerciseId?: number;
    sets: number;
    repsMin: number;
    repsMax: number;
    intent: Intent;
    note?: string | null;
  }>,
  userId: string,
): Promise<ProgramPlan> {
  const levelInfo = await computeCurrentLevel(userId);
  const planningLevel = Math.max(1, Math.min(MAX_LEVEL, levelInfo.currentLevel));
  const benchmark = referenceKg(planningLevel, levelInfo.bodyWeightKg);

  const allExerciseRows = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      equipment: exercisesTable.equipment,
    })
    .from(exercisesTable)
    .where(
      or(
        eq(exercisesTable.isCustom, false),
        eq(exercisesTable.userId, userId),
      ),
    );
  const byName = new Map(allExerciseRows.map((r) => [r.name, r]));
  const byId = new Map(allExerciseRows.map((r) => [r.id, r]));

  const wantedIds = exerciseDefs
    .map((def) => def.exerciseId ?? byName.get(def.name)?.id)
    .filter((id): id is number => id != null);

  const maxByExercise = new Map<number, number>();
  if (wantedIds.length > 0) {
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
          eq(workoutsTable.userId, userId),
          inArray(workoutSetsTable.exerciseId, wantedIds),
        ),
      )
      .orderBy(asc(workoutSetsTable.createdAt));
    for (const s of sets) {
      const w = Number(s.weightKg);
      const prev = maxByExercise.get(s.exerciseId) ?? 0;
      if (w > prev) maxByExercise.set(s.exerciseId, w);
    }
  }

  const exercises: PlannedExercise[] = exerciseDefs
    .map((def) => {
      const row = def.exerciseId != null ? byId.get(def.exerciseId) : byName.get(def.name);
      if (!row) return null;
      const isBodyweight = row.equipment === "bodyweight";
      const intentFactor = INTENT_FACTOR[def.intent];
      const pr = maxByExercise.get(row.id) ?? 0;

      let suggestedWeightKg: number;
      let basedOn: "personal-record" | "level-benchmark";
      if (pr > 0) {
        suggestedWeightKg = pr * intentFactor;
        basedOn = "personal-record";
      } else if (isBodyweight) {
        suggestedWeightKg = 0;
        basedOn = "level-benchmark";
      } else {
        const exFactor = EXERCISE_BENCHMARK_FACTOR[def.name] ?? 0.5;
        const mcResult = getMcKgForExercise(
          def.name,
          levelInfo.bodyWeightKg,
          levelInfo.sex,
          exFactor,
        );
        if (mcResult.kg != null) {
          suggestedWeightKg = mcResult.kg * levelFactor(planningLevel) * intentFactor;
        } else {
          suggestedWeightKg = 0;
        }
        basedOn = "level-benchmark";
      }

      const isBodyweightWithoutLoad = isBodyweight && pr <= 0;
      const minWeight = isBodyweightWithoutLoad ? 0 : suggestedWeightKg > 0 ? 5 : 0;
      const stepped = isBodyweightWithoutLoad
        ? 0
        : Math.max(minWeight, roundTo(suggestedWeightKg, 2.5));

      return {
        exerciseId: row.id,
        name: row.name,
        muscleGroup: row.muscleGroup,
        sets: def.sets,
        repsMin: def.repsMin,
        repsMax: def.repsMax,
        intent: def.intent,
        suggestedWeightKg: stepped,
        isBodyweight,
        equipment: row.equipment,
        basedOn,
        note: def.note ?? null,
      } satisfies PlannedExercise;
    })
    .filter((p): p is PlannedExercise => p !== null);

  return {
    id: programId,
    name,
    description,
    emoji,
    basedOnLevel: planningLevel,
    basedOnLevelName: LEVELS[planningLevel].name,
    benchmarkKg: benchmark,
    isCustom,
    exercises,
  };
}

export async function buildProgramPlan(
  programId: string,
  userId: string = "",
): Promise<ProgramPlan | null> {
  const numericId = Number(programId);
  const isCustomNumericId = Number.isInteger(numericId) && numericId > 0;

  if (isCustomNumericId) {
    const [program] = await db
      .select()
      .from(customProgramsTable)
      .where(
        and(
          eq(customProgramsTable.id, numericId),
          eq(customProgramsTable.userId, userId),
        ),
      );
    if (!program) return null;

    const exRows = await db
      .select()
      .from(customProgramExercisesTable)
      .where(eq(customProgramExercisesTable.programId, numericId))
      .orderBy(asc(customProgramExercisesTable.sortOrder));

    const defs = exRows.map((r) => ({
      name: "",
      exerciseId: r.exerciseId,
      sets: r.sets,
      repsMin: r.repsMin,
      repsMax: r.repsMax,
      intent: r.intent as Intent,
      note: r.note,
    }));

    return buildPlanFromExerciseDefs(
      programId,
      program.name,
      program.description,
      "⚡",
      true,
      defs,
      userId,
    );
  }

  const program = PROGRAMS.find((p) => p.id === programId);
  if (!program) return null;

  return buildPlanFromExerciseDefs(
    programId,
    program.name,
    program.description,
    program.emoji,
    false,
    program.exercises,
    userId,
  );
}
