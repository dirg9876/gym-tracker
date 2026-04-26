import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, isNotNull, or } from "drizzle-orm";
import {
  db,
  workoutsTable,
  workoutSetsTable,
  exercisesTable,
} from "@workspace/db";
import {
  ListWorkoutsQueryParams,
  CreateWorkoutBody,
  GetWorkoutParams,
  DeleteWorkoutParams,
  FinishWorkoutParams,
  AddSetParams,
  AddSetBody,
  DeleteSetParams,
  GetWorkoutComparisonParams,
  GetWorkoutExerciseBreakdownParams,
} from "@workspace/api-zod";
import {
  getWorkoutSets,
  totalsFromSets,
  round,
  getAllSetsForFinishedWorkouts,
  computeExerciseBreakdown,
  type EnrichedSet,
} from "../lib/stats";

const router: IRouter = Router();

function summarizeSets(sets: EnrichedSet[]) {
  const byExercise = new Map<
    number,
    { name: string; sets: number; volume: number; topWeight: number }
  >();
  for (const s of sets) {
    const e = byExercise.get(s.exerciseId) ?? {
      name: s.exerciseName,
      sets: 0,
      volume: 0,
      topWeight: 0,
    };
    e.sets += 1;
    e.volume += s.volume;
    if (s.weightKg > e.topWeight) e.topWeight = s.weightKg;
    byExercise.set(s.exerciseId, e);
  }
  return byExercise;
}

router.get("/workouts", async (req, res): Promise<void> => {
  const parsed = ListWorkoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.userId;
  const limit = parsed.data.limit ?? 50;
  const workouts = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.userId, userId))
    .orderBy(desc(workoutsTable.startedAt))
    .limit(limit);

  const result = await Promise.all(
    workouts.map(async (w) => {
      const sets = await getWorkoutSets(w.id);
      const totals = totalsFromSets(sets);
      const byEx = summarizeSets(sets);
      const top = [...byEx.values()]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 3)
        .map((e) => e.name);
      return {
        id: w.id,
        name: w.name,
        startedAt: w.startedAt.toISOString(),
        finishedAt: w.finishedAt ? w.finishedAt.toISOString() : null,
        totalVolume: totals.totalVolume,
        totalReps: totals.totalReps,
        totalSets: totals.totalSets,
        exerciseCount: byEx.size,
        topExercises: top,
      };
    }),
  );
  res.json(result);
});

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [w] = await db
    .insert(workoutsTable)
    .values({ name: parsed.data.name ?? null, userId: req.userId })
    .returning();
  res.status(201).json({
    id: w.id,
    name: w.name,
    startedAt: w.startedAt.toISOString(),
    finishedAt: null,
    sets: [],
    totalVolume: 0,
    totalReps: 0,
    totalSets: 0,
  });
});

router.get("/workouts/active", async (req, res): Promise<void> => {
  const userId = req.userId;
  const [w] = await db
    .select()
    .from(workoutsTable)
    .where(and(isNull(workoutsTable.finishedAt), eq(workoutsTable.userId, userId)))
    .orderBy(desc(workoutsTable.startedAt))
    .limit(1);
  if (!w) {
    res.json({ workout: null });
    return;
  }
  const sets = await getWorkoutSets(w.id);
  const totals = totalsFromSets(sets);
  res.json({
    workout: {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt.toISOString(),
      finishedAt: w.finishedAt ? w.finishedAt.toISOString() : null,
      sets,
      ...totals,
    },
  });
});

router.get("/workouts/:workoutId", async (req, res): Promise<void> => {
  const parsed = GetWorkoutParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [w] = await db
    .select()
    .from(workoutsTable)
    .where(
      and(
        eq(workoutsTable.id, parsed.data.workoutId),
        eq(workoutsTable.userId, req.userId),
      )
    );
  if (!w) {
    res.status(404).json({ error: "Тренировка не найдена" });
    return;
  }
  const sets = await getWorkoutSets(w.id);
  const totals = totalsFromSets(sets);
  res.json({
    id: w.id,
    name: w.name,
    startedAt: w.startedAt.toISOString(),
    finishedAt: w.finishedAt ? w.finishedAt.toISOString() : null,
    sets,
    ...totals,
  });
});

router.delete("/workouts/:workoutId", async (req, res): Promise<void> => {
  const parsed = DeleteWorkoutParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .delete(workoutsTable)
    .where(
      and(
        eq(workoutsTable.id, parsed.data.workoutId),
        eq(workoutsTable.userId, req.userId),
      )
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Тренировка не найдена" });
    return;
  }
  res.sendStatus(204);
});

router.post("/workouts/:workoutId/sets", async (req, res): Promise<void> => {
  const params = AddSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AddSetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [w] = await db
    .select()
    .from(workoutsTable)
    .where(
      and(
        eq(workoutsTable.id, params.data.workoutId),
        eq(workoutsTable.userId, req.userId),
      )
    );
  if (!w) {
    res.status(404).json({ error: "Тренировка не найдена" });
    return;
  }
  const [ex] = await db
    .select()
    .from(exercisesTable)
    .where(
      and(
        eq(exercisesTable.id, body.data.exerciseId),
        or(
          eq(exercisesTable.isCustom, false),
          isNull(exercisesTable.userId),
          eq(exercisesTable.userId, req.userId),
        )
      )
    );
  if (!ex) {
    res.status(404).json({ error: "Упражнение не найдено" });
    return;
  }
  const [row] = await db
    .insert(workoutSetsTable)
    .values({
      workoutId: params.data.workoutId,
      exerciseId: body.data.exerciseId,
      weightKg: String(body.data.weightKg),
      reps: body.data.reps,
    })
    .returning();
  const w_ = Number(row.weightKg);
  res.status(201).json({
    id: row.id,
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    exerciseName: ex.name,
    muscleGroup: ex.muscleGroup,
    weightKg: w_,
    reps: row.reps,
    volume: round(w_ * row.reps),
    createdAt: row.createdAt.toISOString(),
  });
});

router.delete("/sets/:setId", async (req, res): Promise<void> => {
  const params = DeleteSetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [setWithWorkout] = await db
    .select({ id: workoutSetsTable.id, workoutUserId: workoutsTable.userId })
    .from(workoutSetsTable)
    .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
    .where(eq(workoutSetsTable.id, params.data.setId));
  if (!setWithWorkout) {
    res.status(404).json({ error: "Подход не найден" });
    return;
  }
  if (setWithWorkout.workoutUserId !== req.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db
    .delete(workoutSetsTable)
    .where(eq(workoutSetsTable.id, params.data.setId));
  res.sendStatus(204);
});

router.post("/workouts/:workoutId/finish", async (req, res): Promise<void> => {
  const parsed = FinishWorkoutParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const workoutId = parsed.data.workoutId;
  const userId = req.userId;

  const [w] = await db
    .select()
    .from(workoutsTable)
    .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.userId, userId)));
  if (!w) {
    res.status(404).json({ error: "Тренировка не найдена" });
    return;
  }

  const sets = await getWorkoutSets(workoutId);

  // Compute previous PRs from prior finished workouts
  const previousFinishedSets = await getAllSetsForFinishedWorkouts(userId, {
    beforeWorkoutId: workoutId,
  });
  const previousByWorkout = new Map<number, EnrichedSet[]>();
  for (const s of previousFinishedSets) {
    const arr = previousByWorkout.get(s.workoutId) ?? [];
    arr.push(s);
    previousByWorkout.set(s.workoutId, arr);
  }

  let prevBestTonnage = 0;
  let prevBestReps = 0;
  let prevBestMaxWeight = 0;
  for (const arr of previousByWorkout.values()) {
    const t = totalsFromSets(arr);
    if (t.totalVolume > prevBestTonnage) prevBestTonnage = t.totalVolume;
    if (t.totalReps > prevBestReps) prevBestReps = t.totalReps;
    for (const s of arr) {
      if (s.weightKg > prevBestMaxWeight) prevBestMaxWeight = s.weightKg;
    }
  }

  const totals = totalsFromSets(sets);
  const currentMaxWeight = sets.reduce((m, s) => Math.max(m, s.weightKg), 0);

  // Mark workout finished
  const finishedAt = new Date();
  await db
    .update(workoutsTable)
    .set({ finishedAt })
    .where(eq(workoutsTable.id, workoutId));

  const newPersonalRecords: Array<{
    kind: "tonnage" | "reps" | "max_weight";
    value: number;
    previous: number;
    delta: number;
  }> = [];
  if (sets.length > 0) {
    if (totals.totalVolume > prevBestTonnage) {
      newPersonalRecords.push({
        kind: "tonnage",
        value: totals.totalVolume,
        previous: prevBestTonnage,
        delta: round(totals.totalVolume - prevBestTonnage),
      });
    }
    if (totals.totalReps > prevBestReps) {
      newPersonalRecords.push({
        kind: "reps",
        value: totals.totalReps,
        previous: prevBestReps,
        delta: totals.totalReps - prevBestReps,
      });
    }
    if (currentMaxWeight > prevBestMaxWeight) {
      newPersonalRecords.push({
        kind: "max_weight",
        value: currentMaxWeight,
        previous: prevBestMaxWeight,
        delta: round(currentMaxWeight - prevBestMaxWeight),
      });
    }
  }

  // Per-exercise records
  const prevByExercise = new Map<
    number,
    { maxWeight: number; maxReps: number; maxVolumeSet: number }
  >();
  for (const s of previousFinishedSets) {
    const e = prevByExercise.get(s.exerciseId) ?? {
      maxWeight: 0,
      maxReps: 0,
      maxVolumeSet: 0,
    };
    if (s.weightKg > e.maxWeight) e.maxWeight = s.weightKg;
    if (s.reps > e.maxReps) e.maxReps = s.reps;
    if (s.volume > e.maxVolumeSet) e.maxVolumeSet = s.volume;
    prevByExercise.set(s.exerciseId, e);
  }
  const curByExercise = new Map<
    number,
    {
      name: string;
      muscleGroup: string;
      maxWeightSet: { weight: number; reps: number };
      maxRepsSet: { weight: number; reps: number };
      maxVolumeSet: { weight: number; reps: number; volume: number };
    }
  >();
  for (const s of sets) {
    const e = curByExercise.get(s.exerciseId) ?? {
      name: s.exerciseName,
      muscleGroup: s.muscleGroup,
      maxWeightSet: { weight: 0, reps: 0 },
      maxRepsSet: { weight: 0, reps: 0 },
      maxVolumeSet: { weight: 0, reps: 0, volume: 0 },
    };
    if (s.weightKg > e.maxWeightSet.weight)
      e.maxWeightSet = { weight: s.weightKg, reps: s.reps };
    if (s.reps > e.maxRepsSet.reps)
      e.maxRepsSet = { weight: s.weightKg, reps: s.reps };
    if (s.volume > e.maxVolumeSet.volume)
      e.maxVolumeSet = { weight: s.weightKg, reps: s.reps, volume: s.volume };
    curByExercise.set(s.exerciseId, e);
  }

  const newExerciseRecords: Array<{
    exerciseId: number;
    exerciseName: string;
    muscleGroup: string;
    kind: "max_weight" | "max_reps" | "max_volume_set";
    value: number;
    previous: number;
    reps?: number | null;
    weightKg?: number | null;
  }> = [];
  for (const [exerciseId, cur] of curByExercise.entries()) {
    const prev = prevByExercise.get(exerciseId) ?? {
      maxWeight: 0,
      maxReps: 0,
      maxVolumeSet: 0,
    };
    if (cur.maxWeightSet.weight > prev.maxWeight) {
      newExerciseRecords.push({
        exerciseId,
        exerciseName: cur.name,
        muscleGroup: cur.muscleGroup,
        kind: "max_weight",
        value: cur.maxWeightSet.weight,
        previous: prev.maxWeight,
        reps: cur.maxWeightSet.reps,
        weightKg: cur.maxWeightSet.weight,
      });
    }
    if (cur.maxRepsSet.reps > prev.maxReps) {
      newExerciseRecords.push({
        exerciseId,
        exerciseName: cur.name,
        muscleGroup: cur.muscleGroup,
        kind: "max_reps",
        value: cur.maxRepsSet.reps,
        previous: prev.maxReps,
        reps: cur.maxRepsSet.reps,
        weightKg: cur.maxRepsSet.weight,
      });
    }
    if (cur.maxVolumeSet.volume > prev.maxVolumeSet) {
      newExerciseRecords.push({
        exerciseId,
        exerciseName: cur.name,
        muscleGroup: cur.muscleGroup,
        kind: "max_volume_set",
        value: cur.maxVolumeSet.volume,
        previous: prev.maxVolumeSet,
        reps: cur.maxVolumeSet.reps,
        weightKg: cur.maxVolumeSet.weight,
      });
    }
  }

  const prExerciseIds = new Set(newExerciseRecords.map((r) => r.exerciseId));
  const exerciseBreakdown = await computeExerciseBreakdown(
    workoutId,
    prExerciseIds,
  );

  const durationMinutes = round(
    (finishedAt.getTime() - w.startedAt.getTime()) / 60000,
    1,
  );

  res.json({
    workout: {
      id: w.id,
      name: w.name,
      startedAt: w.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      sets,
      ...totals,
    },
    newPersonalRecords,
    newExerciseRecords,
    durationMinutes,
    exerciseBreakdown,
  });
});

router.get(
  "/workouts/:workoutId/comparison",
  async (req, res): Promise<void> => {
    const parsed = GetWorkoutComparisonParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const workoutId = parsed.data.workoutId;
    const userId = req.userId;
    const [w] = await db
      .select()
      .from(workoutsTable)
      .where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.userId, userId)));
    if (!w) {
      res.status(404).json({ error: "Тренировка не найдена" });
      return;
    }

    const currentSets = await getWorkoutSets(workoutId);
    const currentExerciseIds = new Set(currentSets.map((s) => s.exerciseId));

    const previousCandidates = await db
      .select()
      .from(workoutsTable)
      .where(
        and(
          isNotNull(workoutsTable.finishedAt),
          eq(workoutsTable.userId, userId),
        )
      )
      .orderBy(desc(workoutsTable.startedAt));

    let previous:
      | { workout: typeof previousCandidates[number]; sets: EnrichedSet[]; score: number }
      | null = null;
    for (const cand of previousCandidates) {
      if (cand.id === workoutId) continue;
      if (cand.startedAt >= w.startedAt) continue;
      const sets = await getWorkoutSets(cand.id);
      const exIds = new Set(sets.map((s) => s.exerciseId));
      let overlap = 0;
      for (const id of exIds) if (currentExerciseIds.has(id)) overlap += 1;
      const sameName =
        (w.name ?? "").trim() !== "" && cand.name === w.name ? 100 : 0;
      const score = sameName + overlap;
      if (score > 0 && (!previous || score > previous.score)) {
        previous = { workout: cand, sets, score };
      }
      if (sameName > 0 && previous && previous.score >= 100) break;
    }

    const currentTotals = totalsFromSets(currentSets);
    const previousTotals = previous
      ? totalsFromSets(previous.sets)
      : { totalVolume: 0, totalReps: 0, totalSets: 0 };

    type ExAgg = {
      name: string;
      volume: number;
      reps: number;
      maxWeight: number;
    };
    function aggByExercise(sets: EnrichedSet[]): Map<number, ExAgg> {
      const m = new Map<number, ExAgg>();
      for (const s of sets) {
        const e = m.get(s.exerciseId) ?? {
          name: s.exerciseName,
          volume: 0,
          reps: 0,
          maxWeight: 0,
        };
        e.volume += s.volume;
        e.reps += s.reps;
        if (s.weightKg > e.maxWeight) e.maxWeight = s.weightKg;
        m.set(s.exerciseId, e);
      }
      return m;
    }
    const curAgg = aggByExercise(currentSets);
    const prevAgg = previous ? aggByExercise(previous.sets) : new Map();

    const allIds = new Set<number>([...curAgg.keys(), ...prevAgg.keys()]);
    const exercises = [...allIds].map((id) => {
      const c = curAgg.get(id) ?? {
        name: prevAgg.get(id)?.name ?? "",
        volume: 0,
        reps: 0,
        maxWeight: 0,
      };
      const p = prevAgg.get(id) ?? {
        name: c.name,
        volume: 0,
        reps: 0,
        maxWeight: 0,
      };
      return {
        exerciseId: id,
        name: c.name || p.name,
        currentVolume: round(c.volume),
        previousVolume: round(p.volume),
        deltaVolume: round(c.volume - p.volume),
        currentMaxWeight: c.maxWeight,
        previousMaxWeight: p.maxWeight,
        deltaMaxWeight: round(c.maxWeight - p.maxWeight),
        currentReps: c.reps,
        previousReps: p.reps,
        deltaReps: c.reps - p.reps,
      };
    });
    exercises.sort((a, b) => Math.abs(b.deltaVolume) - Math.abs(a.deltaVolume));

    const curDuration =
      w.finishedAt && w.startedAt
        ? (w.finishedAt.getTime() - w.startedAt.getTime()) / 60000
        : null;
    const prevDuration =
      previous && previous.workout.finishedAt
        ? (previous.workout.finishedAt.getTime() -
            previous.workout.startedAt.getTime()) /
          60000
        : null;
    const durationDeltaMinutes =
      curDuration !== null && prevDuration !== null
        ? round(curDuration - prevDuration)
        : null;

    res.json({
      workoutId,
      previousWorkoutId: previous?.workout.id ?? null,
      previousWorkoutDate: previous?.workout.startedAt.toISOString() ?? null,
      previousWorkoutName: previous?.workout.name ?? null,
      deltaVolume: round(currentTotals.totalVolume - previousTotals.totalVolume),
      deltaReps: currentTotals.totalReps - previousTotals.totalReps,
      deltaSets: currentTotals.totalSets - previousTotals.totalSets,
      durationDeltaMinutes,
      exercises,
    });
  },
);

router.get(
  "/workouts/:workoutId/exercise-breakdown",
  async (req, res): Promise<void> => {
    const parsed = GetWorkoutExerciseBreakdownParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const workoutId = parsed.data.workoutId;
    const [w] = await db
      .select()
      .from(workoutsTable)
      .where(
        and(
          eq(workoutsTable.id, workoutId),
          eq(workoutsTable.userId, req.userId),
        )
      );
    if (!w) {
      res.status(404).json({ error: "Тренировка не найдена" });
      return;
    }
    const items = await computeExerciseBreakdown(workoutId);
    res.json({ workoutId, items });
  },
);

export default router;
