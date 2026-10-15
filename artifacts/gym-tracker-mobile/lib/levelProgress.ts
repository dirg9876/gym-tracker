import type { MainExerciseStat } from "@workspace/api-client-react";

export function isExercisePassed(exercise: MainExerciseStat, bodyWeightKg: number): boolean {
  if (exercise.autoPassedReason) return true;
  const required = exercise.requiredKgForNextLevel;
  if (required == null) return false;
  if (exercise.mcSource === "bodyweight" && required <= bodyWeightKg) return true;
  return exercise.maxWeightKg >= required;
}
