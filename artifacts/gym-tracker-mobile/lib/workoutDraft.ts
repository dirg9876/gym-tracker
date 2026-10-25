import { z } from "zod";
import type { Equipment } from "@workspace/api-client-react";
import { coachFieldsSchema, timerSchema } from "./trainingCoach";
import { isTimedExercise, minimumWeight, sameLoadCategory } from "./workoutMeasurement";

export const draftRevisionSchema = z.number().int().nonnegative().safe();
export const draftAssessmentSchema = z.object({ rir: z.boolean(), technique: z.boolean() }).strict();
export type DraftAssessment = z.infer<typeof draftAssessmentSchema>;
export const workoutDraftSchema = z.object({
  exerciseId: z.number().int().positive().safe(),
  weightKg: z.number().finite().nonnegative(),
  reps: z.number().int().nonnegative().safe(),
  durationSeconds: z.number().int().min(1).max(86400).optional(),
  rir: coachFieldsSchema.shape.rir,
  technique: coachFieldsSchema.shape.technique,
  sourceTimer: timerSchema.optional(),
}).strict().refine(draft => draft.durationSeconds != null
  ? draft.weightKg === 0 && draft.reps === 0 && draft.rir == null
  : draft.reps > 0 && Number.isFinite(draft.weightKg * draft.reps));
export const draftCommitSchema = z.object({ revision: draftRevisionSchema, setId: z.number().int().positive().safe() });
export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;
export type DraftResponse = { draft: WorkoutDraft | null; revision: number; assessment?: DraftAssessment };
export function assessmentForDraft(workout: { draft?: Pick<WorkoutDraft, "rir" | "technique">; draftRevision?: number; draftAssessment?: DraftAssessment & { revision: number } }): DraftAssessment {
  const current = workout.draftAssessment?.revision === (workout.draftRevision ?? 0) ? workout.draftAssessment : null;
  return { rir: workout.draft?.rir != null && current?.rir === true, technique: workout.draft?.technique != null && current?.technique === true };
}

export function validDraftForExercise(draft: WorkoutDraft, exercise: { id: number; name: string; equipment: Equipment; deletedAt?: string }) {
  return !exercise.deletedAt && exercise.id === draft.exerciseId && (isTimedExercise(exercise.name)
    ? draft.durationSeconds != null
    : draft.durationSeconds == null && draft.weightKg >= minimumWeight(exercise.equipment))
    && (!draft.sourceTimer || (draft.sourceTimer.kind === "plank" && draft.sourceTimer.exerciseId === draft.exerciseId && draft.durationSeconds != null));
}

export function makeWorkoutDraft(exercise: { id: number; name: string; equipment: Equipment }, target?: { weightKg: number; reps: number; durationSeconds?: number }, assessment?: { rir?: number | null; technique?: "good" | "breakdown" | null }): WorkoutDraft {
  return workoutDraftSchema.parse({
    exerciseId: exercise.id,
    ...(isTimedExercise(exercise.name)
      ? { weightKg: 0, reps: 0, durationSeconds: target?.durationSeconds ?? 30 }
      : { weightKg: target?.weightKg ?? (exercise.equipment === "bodyweight" ? 0 : exercise.equipment === "dumbbell" ? 10 : 20), reps: target?.reps ?? 10 }),
    rir: isTimedExercise(exercise.name) ? null : assessment?.rir ?? null, technique: assessment?.technique ?? null,
  });
}

export function selectWorkoutDraft(exercise: { id: number; name: string; equipment: Equipment; loadMode?: "weight" | "assisted" }, target: { weightKg: number; reps: number; durationSeconds?: number } | undefined, current: WorkoutDraft | null, sets: Array<{ exerciseId: number; equipment?: Equipment; loadMode?: "weight" | "assisted"; weightKg: number; reps: number; durationSeconds?: number; rir?: number | null; technique?: "good" | "breakdown" | null }>): WorkoutDraft {
  if (current?.exerciseId === exercise.id) return current;
  const previous = sets.slice().reverse().find(set => set.exerciseId === exercise.id && sameLoadCategory(set, exercise));
  const recordedTarget = isTimedExercise(exercise.name) && !previous?.durationSeconds ? undefined : previous;
  return makeWorkoutDraft(exercise, target ?? recordedTarget, previous);
}

export const sameTimer = (a: z.infer<typeof timerSchema>, b: z.infer<typeof timerSchema>) => JSON.stringify(timerSchema.parse(a)) === JSON.stringify(timerSchema.parse(b));
export const sameDraft = (a: WorkoutDraft | null, b: WorkoutDraft | null) => a == null || b == null ? a === b : JSON.stringify(workoutDraftSchema.parse(a)) === JSON.stringify(workoutDraftSchema.parse(b));

// Only for idempotent commit/transfer endpoints, never an ordinary set addition.
export async function retryDraftAction<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    return action();
  }
}
