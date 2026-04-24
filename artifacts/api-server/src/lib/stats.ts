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

export async function getAllSetsForFinishedWorkouts(opts?: {
  beforeWorkoutId?: number;
}): Promise<EnrichedSet[]> {
  const conditions = [isNotNull(workoutsTable.finishedAt)];
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

export async function listFinishedWorkouts(): Promise<
  { id: number; startedAt: Date; finishedAt: Date | null; name: string | null }[]
> {
  return db
    .select()
    .from(workoutsTable)
    .where(isNotNull(workoutsTable.finishedAt))
    .orderBy(desc(workoutsTable.startedAt));
}
