import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import {
  db,
  exercisesTable,
  workoutsTable,
  workoutSetsTable,
} from "@workspace/db";
import {
  ListExercisesResponse,
  CreateExerciseBody,
  DeleteExerciseParams,
  GetExerciseLastSetsParams,
  UpdateExerciseParams,
  UpdateExerciseBody,
} from "@workspace/api-zod";
import {
  getProfile,
  FALLBACK_BODY_WEIGHT_KG,
  FALLBACK_SEX,
} from "../lib/profile";
import { getMcKgForExercise } from "../lib/sport-norms";

const router: IRouter = Router();

router.get("/exercises", async (_req, res): Promise<void> => {
  const [rows, profile] = await Promise.all([
    db
      .select()
      .from(exercisesTable)
      .orderBy(exercisesTable.muscleGroup, exercisesTable.name),
    getProfile(),
  ]);

  const bodyWeightKg = profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
  const sex = profile.sex ?? FALLBACK_SEX;

  const enriched = rows.map((ex) => {
    if (!ex.isMain) return ex;
    const fallbackMul = Number(ex.bodyweightMultiplier ?? 1);
    const result = getMcKgForExercise(ex.name, bodyWeightKg, sex, fallbackMul);
    return { ...ex, mcKg: result.kg };
  });

  res.json(ListExercisesResponse.parse(enriched));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(exercisesTable)
    .values({
      name: parsed.data.name.trim(),
      muscleGroup: parsed.data.muscleGroup.trim(),
      isCustom: true,
      ...(parsed.data.equipment !== undefined
        ? { equipment: parsed.data.equipment }
        : {}),
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/exercises/:exerciseId", async (req, res): Promise<void> => {
  const params = UpdateExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateExerciseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates: Partial<typeof exercisesTable.$inferInsert> = {};
  if (body.data.isMain !== undefined) updates.isMain = body.data.isMain;
  if (body.data.equipment !== undefined) updates.equipment = body.data.equipment;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Не передано ни одного поля для обновления" });
    return;
  }
  const [row] = await db
    .update(exercisesTable)
    .set(updates)
    .where(eq(exercisesTable.id, params.data.exerciseId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  res.json(row);
});

router.delete("/exercises/:exerciseId", async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(exercisesTable)
    .where(eq(exercisesTable.id, params.data.exerciseId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  res.sendStatus(204);
});

router.get(
  "/exercises/:exerciseId/last-sets",
  async (req, res): Promise<void> => {
    const parsed = GetExerciseLastSetsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const exerciseId = parsed.data.exerciseId;

    const sets = await db
      .select({
        setId: workoutSetsTable.id,
        workoutId: workoutSetsTable.workoutId,
        weightKg: workoutSetsTable.weightKg,
        reps: workoutSetsTable.reps,
        createdAt: workoutSetsTable.createdAt,
        workoutName: workoutsTable.name,
        workoutStartedAt: workoutsTable.startedAt,
      })
      .from(workoutSetsTable)
      .innerJoin(
        workoutsTable,
        eq(workoutSetsTable.workoutId, workoutsTable.id),
      )
      .where(
        and(
          eq(workoutSetsTable.exerciseId, exerciseId),
          isNotNull(workoutsTable.finishedAt),
        ),
      )
      .orderBy(desc(workoutsTable.startedAt), asc(workoutSetsTable.createdAt));

    let bestEverWeightKg: number | null = null;
    let bestEverReps: number | null = null;
    for (const s of sets) {
      const w = Number(s.weightKg);
      if (bestEverWeightKg === null || w > bestEverWeightKg) {
        bestEverWeightKg = w;
        bestEverReps = s.reps;
      } else if (w === bestEverWeightKg && (bestEverReps ?? 0) < s.reps) {
        bestEverReps = s.reps;
      }
    }

    if (sets.length === 0) {
      res.json({
        exerciseId,
        workoutId: null,
        workoutName: null,
        workoutDate: null,
        sets: [],
        bestEverWeightKg: null,
        bestEverReps: null,
      });
      return;
    }

    const lastWorkoutId = sets[0]!.workoutId;
    const lastSets = sets
      .filter((s) => s.workoutId === lastWorkoutId)
      .map((s) => ({ weightKg: Number(s.weightKg), reps: s.reps }));

    res.json({
      exerciseId,
      workoutId: lastWorkoutId,
      workoutName: sets[0]!.workoutName,
      workoutDate: sets[0]!.workoutStartedAt.toISOString(),
      sets: lastSets,
      bestEverWeightKg,
      bestEverReps,
    });
  },
);

export default router;
