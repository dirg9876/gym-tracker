import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import {
  db,
  exercisesTable,
  userExercisePrefsTable,
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
import {
  getMcKgForExercise,
  getRankNormsForExercise,
  rankForMcPercent,
  type SportRank,
} from "../lib/sport-norms";
import type { Equipment } from "@workspace/db";

const router: IRouter = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const userId = req.userId;
  const [rows, profile] = await Promise.all([
    db
      .select({
        id: exercisesTable.id,
        userId: exercisesTable.userId,
        name: exercisesTable.name,
        muscleGroup: exercisesTable.muscleGroup,
        isCustom: exercisesTable.isCustom,
        bodyweightMultiplier: exercisesTable.bodyweightMultiplier,
        createdAt: exercisesTable.createdAt,
        // Global fallback values
        baseIsMain: exercisesTable.isMain,
        baseEquipment: exercisesTable.equipment,
        // Per-user overrides (null when no pref row exists)
        prefIsMain: userExercisePrefsTable.isMain,
        prefEquipment: userExercisePrefsTable.equipment,
      })
      .from(exercisesTable)
      .leftJoin(
        userExercisePrefsTable,
        and(
          eq(userExercisePrefsTable.exerciseId, exercisesTable.id),
          eq(userExercisePrefsTable.userId, userId),
        ),
      )
      .where(
        or(
          eq(exercisesTable.isCustom, false),
          eq(exercisesTable.userId, userId),
        ),
      )
      .orderBy(exercisesTable.muscleGroup, exercisesTable.name),
    getProfile(userId),
  ]);

  const bodyWeightKg = profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
  const sex = profile.sex ?? FALLBACK_SEX;

  // Bulk-load max weight per exercise (only from finished workouts)
  const maxWeightRows = await db
    .select({
      exerciseId: workoutSetsTable.exerciseId,
      maxKg: max(workoutSetsTable.weightKg),
    })
    .from(workoutSetsTable)
    .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
    .where(and(isNotNull(workoutsTable.finishedAt), eq(workoutsTable.userId, userId)))
    .groupBy(workoutSetsTable.exerciseId);

  const maxByExercise = new Map<number, number>();
  for (const r of maxWeightRows) {
    if (r.maxKg != null) maxByExercise.set(r.exerciseId, Number(r.maxKg));
  }

  const enriched = rows.map((row) => {
    // Per-user pref takes priority over the global column. prefIsMain is null
    // (not false) when no pref row exists — so we distinguish "user set false"
    // from "no pref".
    const isMain = row.prefIsMain !== null ? row.prefIsMain : row.baseIsMain;
    const equipment: Equipment = (row.prefEquipment ?? row.baseEquipment) as Equipment;

    const fallbackMul = Number(row.bodyweightMultiplier ?? 1);
    const result = getMcKgForExercise(row.name, bodyWeightKg, sex, fallbackMul, row.muscleGroup);
    const mcKg = isMain ? result.kg : null;

    const userMaxKg = maxByExercise.get(row.id) ?? null;
    let userRank: SportRank | null = null;
    if (result.kg != null && userMaxKg != null && userMaxKg > 0) {
      userRank = rankForMcPercent(userMaxKg / result.kg);
    }

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      muscleGroup: row.muscleGroup,
      isCustom: row.isCustom,
      bodyweightMultiplier: row.bodyweightMultiplier,
      createdAt: row.createdAt,
      isMain,
      equipment,
      mcKg,
      userMaxKg,
      userRank,
    };
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
      userId: req.userId,
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
  if (body.data.isMain === undefined && body.data.equipment === undefined) {
    res.status(400).json({ error: "Не передано ни одного поля для обновления" });
    return;
  }

  const userId = req.userId;

  // Fetch the exercise to check visibility. The user may update isMain/equipment
  // for any exercise visible to them (global catalog or their own custom).
  // For custom exercises owned by another user, access is denied.
  const [existing] = await db
    .select({
      id: exercisesTable.id,
      name: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
      isCustom: exercisesTable.isCustom,
      isMain: exercisesTable.isMain,
      equipment: exercisesTable.equipment,
      userId: exercisesTable.userId,
      bodyweightMultiplier: exercisesTable.bodyweightMultiplier,
      createdAt: exercisesTable.createdAt,
    })
    .from(exercisesTable)
    .where(eq(exercisesTable.id, params.data.exerciseId));

  if (!existing) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  // Custom exercises belonging to another user are not accessible.
  if (existing.isCustom && existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Read the user's existing pref row (if any) so partial updates don't
  // clobber unspecified fields. e.g. PATCH {equipment} only must not reset
  // isMain to false.
  const [existingPref] = await db
    .select()
    .from(userExercisePrefsTable)
    .where(
      and(
        eq(userExercisePrefsTable.userId, userId),
        eq(userExercisePrefsTable.exerciseId, existing.id),
      ),
    )
    .limit(1);

  // Merge: body overrides existing pref; existing pref overrides global default.
  const effectiveIsMain =
    body.data.isMain !== undefined
      ? body.data.isMain
      : (existingPref?.isMain ?? existing.isMain);
  const effectiveEquipment: Equipment =
    body.data.equipment !== undefined
      ? (body.data.equipment as Equipment)
      : ((existingPref?.equipment ?? existing.equipment) as Equipment);

  // Upsert the per-user pref row. This keeps the global exercises table
  // unchanged, so no other user sees a difference.
  const [upsertedPref] = await db
    .insert(userExercisePrefsTable)
    .values({
      userId,
      exerciseId: existing.id,
      isMain: effectiveIsMain,
      equipment: effectiveEquipment,
    })
    .onConflictDoUpdate({
      target: [userExercisePrefsTable.userId, userExercisePrefsTable.exerciseId],
      set: {
        isMain: effectiveIsMain,
        equipment: effectiveEquipment,
        updatedAt: sql`now()`,
      },
    })
    .returning();

  // Build the response by merging exercise data with the pref.
  const isMain = upsertedPref!.isMain;
  const equipment: Equipment = (upsertedPref!.equipment ?? existing.equipment) as Equipment;

  res.json({
    id: existing.id,
    userId: existing.userId,
    name: existing.name,
    muscleGroup: existing.muscleGroup,
    isCustom: existing.isCustom,
    isMain,
    equipment,
    bodyweightMultiplier: existing.bodyweightMultiplier,
    createdAt: existing.createdAt,
  });
});

router.delete("/exercises/:exerciseId", async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(exercisesTable)
    .where(
      and(
        eq(exercisesTable.id, params.data.exerciseId),
        eq(exercisesTable.isCustom, true),
        eq(exercisesTable.userId, req.userId),
      )
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Не найдено" });
    return;
  }
  res.sendStatus(204);
});

router.get(
  "/exercises/:exerciseId/norms",
  async (req, res): Promise<void> => {
    const exerciseId = parseInt(req.params.exerciseId ?? "", 10);
    if (!Number.isFinite(exerciseId) || exerciseId <= 0) {
      res.status(400).json({ error: "Invalid exerciseId" });
      return;
    }

    const [exRow] = await db
      .select()
      .from(exercisesTable)
      .where(
        and(
          eq(exercisesTable.id, exerciseId),
          or(
            eq(exercisesTable.isCustom, false),
            eq(exercisesTable.userId, req.userId),
          ),
        ),
      )
      .limit(1);

    if (!exRow) {
      res.status(404).json({ error: "Не найдено" });
      return;
    }

    const userId = req.userId;
    const profile = await getProfile(userId);
    const bodyWeightKg = profile.bodyWeightKg ?? FALLBACK_BODY_WEIGHT_KG;
    const sex = profile.sex ?? FALLBACK_SEX;

    const fallbackMul = Number(exRow.bodyweightMultiplier ?? 1);
    const mcResult = getMcKgForExercise(
      exRow.name,
      bodyWeightKg,
      sex,
      fallbackMul,
      exRow.muscleGroup,
    );

    // Max weight for this exercise across finished workouts for this user
    const maxRows = await db
      .select({ maxKg: max(workoutSetsTable.weightKg) })
      .from(workoutSetsTable)
      .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
      .where(
        and(
          eq(workoutSetsTable.exerciseId, exerciseId),
          isNotNull(workoutsTable.finishedAt),
          eq(workoutsTable.userId, req.userId),
        ),
      );

    const userMaxWeightKg =
      maxRows[0]?.maxKg != null ? Number(maxRows[0].maxKg) : null;

    if (mcResult.kg == null) {
      // Time-based exercise — no rank ladder
      res.json({
        mcKg: null,
        mcSource: mcResult.source,
        userMaxWeightKg,
        currentRank: null,
        nextRank: null,
        kgToNextRank: null,
        rankNorms: [],
      });
      return;
    }

    const rankNorms = getRankNormsForExercise(mcResult.kg);

    // currentRank is null when the user has no recorded sets (no-data semantics).
    // Once they have a result we compute the actual rank (may be NONE = below III р.).
    const currentRank =
      userMaxWeightKg != null && userMaxWeightKg > 0
        ? rankForMcPercent(userMaxWeightKg / mcResult.kg)
        : null;

    const currentIdx =
      currentRank != null
        ? rankNorms.findIndex((r) => r.rank.code === currentRank.code)
        : -1;
    const nextEntry = rankNorms[currentIdx + 1] ?? rankNorms[0] ?? null;
    const nextRank = nextEntry?.rank ?? null;
    const kgToNextRank =
      nextEntry != null && userMaxWeightKg != null
        ? Math.max(0, nextEntry.kgTarget - userMaxWeightKg)
        : nextEntry != null
          ? nextEntry.kgTarget
          : null;

    res.json({
      mcKg: mcResult.kg,
      mcSource: mcResult.source,
      userMaxWeightKg,
      currentRank,
      nextRank,
      kgToNextRank,
      rankNorms,
    });
  },
);

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
          eq(workoutsTable.userId, req.userId),
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
