import { db } from "@workspace/db";
import {
  exercisesTable,
  workoutsTable,
  workoutSetsTable,
} from "@workspace/db";
import { eq, and, isNotNull, lt, desc, asc } from "drizzle-orm";

export type EnrichedSet = {
  id: number;
  workoutId: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  weightKg: number;
  reps: number;
  volume: number;
  createdAt: string;
};

export type WorkoutTotals = {
  totalVolume: number;
  totalReps: number;
  totalSets: number;
};

export function totalsFromSets(sets: EnrichedSet[]): WorkoutTotals {
  let v = 0;
  let r = 0;
  for (const s of sets) {
    v += s.volume;
    r += s.reps;
  }
  return { totalVolume: round(v), totalReps: r, totalSets: sets.length };
}

export function round(n: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export async function getWorkoutSets(workoutId: number): Promise<EnrichedSet[]> {
  const rows = await db
    .select({
      id: workoutSetsTable.id,
      workoutId: workoutSetsTable.workoutId,
      exerciseId: workoutSetsTable.exerciseId,
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      createdAt: workoutSetsTable.createdAt,
      exerciseName: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
    })
    .from(workoutSetsTable)
    .innerJoin(exercisesTable, eq(workoutSetsTable.exerciseId, exercisesTable.id))
    .where(eq(workoutSetsTable.workoutId, workoutId))
    .orderBy(asc(workoutSetsTable.createdAt));

  return rows.map((r) => {
    const w = Number(r.weightKg);
    return {
      id: r.id,
      workoutId: r.workoutId,
      exerciseId: r.exerciseId,
      exerciseName: r.exerciseName,
      muscleGroup: r.muscleGroup,
      weightKg: w,
      reps: r.reps,
      volume: round(w * r.reps),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function getAllSetsForFinishedWorkouts(
  userId: string,
  opts?: { beforeWorkoutId?: number },
): Promise<EnrichedSet[]> {
  const conditions = [
    isNotNull(workoutsTable.finishedAt),
    eq(workoutsTable.userId, userId),
  ];
  if (opts?.beforeWorkoutId !== undefined) {
    conditions.push(lt(workoutSetsTable.workoutId, opts.beforeWorkoutId));
  }
  const rows = await db
    .select({
      id: workoutSetsTable.id,
      workoutId: workoutSetsTable.workoutId,
      exerciseId: workoutSetsTable.exerciseId,
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      createdAt: workoutSetsTable.createdAt,
      exerciseName: exercisesTable.name,
      muscleGroup: exercisesTable.muscleGroup,
    })
    .from(workoutSetsTable)
    .innerJoin(workoutsTable, eq(workoutSetsTable.workoutId, workoutsTable.id))
    .innerJoin(exercisesTable, eq(workoutSetsTable.exerciseId, exercisesTable.id))
    .where(and(...conditions))
    .orderBy(asc(workoutSetsTable.createdAt));

  return rows.map((r) => {
    const w = Number(r.weightKg);
    return {
      id: r.id,
      workoutId: r.workoutId,
      exerciseId: r.exerciseId,
      exerciseName: r.exerciseName,
      muscleGroup: r.muscleGroup,
      weightKg: w,
      reps: r.reps,
      volume: round(w * r.reps),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function listFinishedWorkouts(
  userId: string,
): Promise<{ id: number; startedAt: Date; finishedAt: Date | null; name: string | null }[]> {
  return db
    .select()
    .from(workoutsTable)
    .where(and(isNotNull(workoutsTable.finishedAt), eq(workoutsTable.userId, userId)))
    .orderBy(desc(workoutsTable.startedAt));
}

export type ExerciseBreakdownItem = {
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  reps: number;
  volume: number;
  topSetWeight: number;
  topSetReps: number;
  previousSessionWorkoutId: number | null;
  previousSessionWorkoutName: string | null;
  previousSessionDate: string | null;
  previousSessionVolume: number | null;
  previousSessionTopWeight: number | null;
  previousSessionTotalReps: number | null;
  deltaVolume: number | null;
  deltaTopWeight: number | null;
  deltaReps: number | null;
  isPersonalRecord: boolean;
};

/**
 * Compute per-exercise breakdown for a workout: today's totals + the most
 * recent prior finished session that included each exercise + deltas + a PR
 * flag.
 *
 * `isPersonalRecord` uses the SAME criteria as the finish endpoint's
 * `newExerciseRecords` (max single-set weight, max single-set reps, or max
 * single-set volume strictly exceeds the all-time best across prior finished
 * workouts). When this helper is called from the finish endpoint, the caller
 * may pass `prExerciseIds` to short-circuit and stay perfectly in sync with
 * `newExerciseRecords`. When omitted, the helper recomputes the same
 * condition itself so standalone callers see consistent results.
 *
 * Only sets in finished workouts that occurred BEFORE this workout's
 * startedAt (and are not this workout) count as history.
 */
export async function computeExerciseBreakdown(
  workoutId: number,
  prExerciseIds?: Set<number>,
): Promise<ExerciseBreakdownItem[]> {
  const [w] = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.id, workoutId));
  if (!w) return [];

  const currentSets = await getWorkoutSets(workoutId);
  if (currentSets.length === 0) return [];

  // All sets from finished workouts strictly older than this one (and not this one),
  // scoped to the same user.
  const priorRows = await db
    .select({
      id: workoutSetsTable.id,
      workoutId: workoutSetsTable.workoutId,
      exerciseId: workoutSetsTable.exerciseId,
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      createdAt: workoutSetsTable.createdAt,
      workoutStartedAt: workoutsTable.startedAt,
      workoutName: workoutsTable.name,
    })
    .from(workoutSetsTable)
    .innerJoin(
      workoutsTable,
      eq(workoutSetsTable.workoutId, workoutsTable.id),
    )
    .where(
      and(
        isNotNull(workoutsTable.finishedAt),
        lt(workoutsTable.startedAt, w.startedAt),
        eq(workoutsTable.userId, w.userId),
      ),
    );

  type PriorSet = {
    workoutId: number;
    exerciseId: number;
    weightKg: number;
    reps: number;
    volume: number;
    workoutStartedAt: Date;
    workoutName: string | null;
  };
  const priorByExercise = new Map<number, PriorSet[]>();
  for (const r of priorRows) {
    if (r.workoutId === workoutId) continue;
    const wkg = Number(r.weightKg);
    const ps: PriorSet = {
      workoutId: r.workoutId,
      exerciseId: r.exerciseId,
      weightKg: wkg,
      reps: r.reps,
      volume: round(wkg * r.reps),
      workoutStartedAt: r.workoutStartedAt,
      workoutName: r.workoutName,
    };
    const arr = priorByExercise.get(r.exerciseId) ?? [];
    arr.push(ps);
    priorByExercise.set(r.exerciseId, arr);
  }

  // Group current sets by exercise
  type CurAgg = {
    exerciseId: number;
    exerciseName: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    volume: number;
    topSetWeight: number;
    topSetReps: number;
  };
  const curByExercise = new Map<number, CurAgg>();
  for (const s of currentSets) {
    const agg = curByExercise.get(s.exerciseId) ?? {
      exerciseId: s.exerciseId,
      exerciseName: s.exerciseName,
      muscleGroup: s.muscleGroup,
      sets: 0,
      reps: 0,
      volume: 0,
      topSetWeight: 0,
      topSetReps: 0,
    };
    agg.sets += 1;
    agg.reps += s.reps;
    agg.volume += s.volume;
    if (s.weightKg > agg.topSetWeight) {
      agg.topSetWeight = s.weightKg;
      agg.topSetReps = s.reps;
    } else if (s.weightKg === agg.topSetWeight && s.reps > agg.topSetReps) {
      agg.topSetReps = s.reps;
    }
    curByExercise.set(s.exerciseId, agg);
  }

  const result: ExerciseBreakdownItem[] = [];
  for (const cur of curByExercise.values()) {
    const prior = priorByExercise.get(cur.exerciseId) ?? [];

    // Find the most recent prior workout that includes this exercise
    let prevWorkoutId: number | null = null;
    let prevWorkoutStartedAt: Date | null = null;
    let prevWorkoutName: string | null = null;
    for (const p of prior) {
      if (
        prevWorkoutStartedAt === null ||
        p.workoutStartedAt > prevWorkoutStartedAt
      ) {
        prevWorkoutStartedAt = p.workoutStartedAt;
        prevWorkoutId = p.workoutId;
        prevWorkoutName = p.workoutName;
      }
    }

    let prevSessionVolume: number | null = null;
    let prevSessionTopWeight: number | null = null;
    let prevSessionTotalReps: number | null = null;
    if (prevWorkoutId !== null) {
      const prevSets = prior.filter((p) => p.workoutId === prevWorkoutId);
      let v = 0;
      let r = 0;
      let topW = 0;
      for (const ps of prevSets) {
        v += ps.volume;
        r += ps.reps;
        if (ps.weightKg > topW) topW = ps.weightKg;
      }
      prevSessionVolume = round(v);
      prevSessionTotalReps = r;
      prevSessionTopWeight = topW;
    }

    // PR detection — must match the finish endpoint's `newExerciseRecords`
    // criteria (per-set max weight, per-set max reps, per-set max volume).
    let isPR: boolean;
    if (prExerciseIds) {
      isPR = prExerciseIds.has(cur.exerciseId);
    } else {
      let bestEverWeight = 0;
      let bestEverReps = 0;
      let bestEverVolumeSet = 0;
      for (const ps of prior) {
        if (ps.weightKg > bestEverWeight) bestEverWeight = ps.weightKg;
        if (ps.reps > bestEverReps) bestEverReps = ps.reps;
        if (ps.volume > bestEverVolumeSet) bestEverVolumeSet = ps.volume;
      }
      const curSetsForEx = currentSets.filter(
        (s) => s.exerciseId === cur.exerciseId,
      );
      const maxCurReps = curSetsForEx.reduce(
        (m, s) => Math.max(m, s.reps),
        0,
      );
      const maxCurSetVolume = curSetsForEx.reduce(
        (m, s) => Math.max(m, s.volume),
        0,
      );
      isPR =
        cur.topSetWeight > bestEverWeight ||
        maxCurReps > bestEverReps ||
        maxCurSetVolume > bestEverVolumeSet;
    }

    result.push({
      exerciseId: cur.exerciseId,
      exerciseName: cur.exerciseName,
      muscleGroup: cur.muscleGroup,
      sets: cur.sets,
      reps: cur.reps,
      volume: round(cur.volume),
      topSetWeight: cur.topSetWeight,
      topSetReps: cur.topSetReps,
      previousSessionWorkoutId: prevWorkoutId,
      previousSessionWorkoutName: prevWorkoutName,
      previousSessionDate: prevWorkoutStartedAt
        ? prevWorkoutStartedAt.toISOString()
        : null,
      previousSessionVolume: prevSessionVolume,
      previousSessionTopWeight: prevSessionTopWeight,
      previousSessionTotalReps: prevSessionTotalReps,
      deltaVolume:
        prevSessionVolume !== null
          ? round(round(cur.volume) - prevSessionVolume)
          : null,
      deltaTopWeight:
        prevSessionTopWeight !== null
          ? round(cur.topSetWeight - prevSessionTopWeight)
          : null,
      deltaReps:
        prevSessionTotalReps !== null ? cur.reps - prevSessionTotalReps : null,
      isPersonalRecord: isPR,
    });
  }

  // Stable order: by current volume desc
  result.sort((a, b) => b.volume - a.volume);
  return result;
}
