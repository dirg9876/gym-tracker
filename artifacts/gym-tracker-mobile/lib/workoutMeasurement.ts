import type { Equipment, WorkoutSet } from "@workspace/api-client-react";
import type { CoachFields } from "./trainingCoach";

// Optional offline fields keep old backups readable without treating old reps as seconds.
export type DurationMetrics = { durationSeconds?: number; maxDurationSeconds?: number };
export type MeasuredSet = WorkoutSet & DurationMetrics & CoachFields;

export function isTimedExercise(name: string): boolean {
  return /^(боковая )?планка$/i.test(name.trim());
}

export function durationOf(value: object): number {
  return (value as DurationMetrics).durationSeconds ?? 0;
}

export function maxDurationOf(value: object): number {
  return (value as DurationMetrics).maxDurationSeconds ?? 0;
}

export function formatSeconds(seconds: number): string {
  return `${seconds.toLocaleString("ru-RU")} с`;
}

export function minimumWeight(equipment: Equipment): number {
  return equipment === "barbell" ? 20 : 0;
}

export function weightLabel(equipment?: Equipment): string {
  if (equipment === "barbell") return "Вес со штангой (кг)";
  if (equipment === "dumbbell") return "Вес одной гантели (кг)";
  if (equipment === "bodyweight") return "Дополнительный вес (кг)";
  return "Вес (кг)";
}

export function formatSetResult(set: WorkoutSet): string {
  if (isTimedExercise(set.exerciseName)) return durationOf(set) > 0 ? formatSeconds(durationOf(set)) : "Время не указано (старая запись)";
  if (set.weightKg === 0) return `${set.reps} повт.`;
  return `${set.weightKg.toLocaleString("ru-RU")} кг × ${set.reps}`;
}

export function formatSetContext(set: WorkoutSet): string {
  const recorded = set as MeasuredSet;
  return [recorded.rir != null ? `Запас ${recorded.rir === 5 ? "5+" : recorded.rir}` : null, recorded.technique === "good" ? "техника сохранена" : recorded.technique === "breakdown" ? "техника нарушалась" : null].filter(Boolean).join(" · ");
}
