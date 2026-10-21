import type { Equipment, WorkoutSet } from "@workspace/api-client-react";
import type { CoachFields } from "./trainingCoach";
import { isAssisted, type EquipmentSettings } from "./equipmentSettings";

// Optional offline fields keep old backups readable without treating old reps as seconds.
export type DurationMetrics = { durationSeconds?: number; maxDurationSeconds?: number };
export type MeasuredSet = WorkoutSet & DurationMetrics & CoachFields & EquipmentSettings & {
  equipment?: Equipment; bodyWeightKg?: number; bodyWeightEstimated?: boolean; effectiveWeightKg?: number;
};

// Legacy sets inherit the catalog until their first category change snapshots it.
export function sameLoadCategory(set: { equipment?: Equipment; loadMode?: "weight" | "assisted" }, exercise: { equipment: Equipment; loadMode?: "weight" | "assisted" }): boolean {
  return (set.equipment ?? exercise.equipment) === exercise.equipment && isAssisted(set) === isAssisted(exercise);
}

export function setVolume(weightKg: number, reps: number, equipment?: Equipment, bodyWeightKg?: number | null, timed = false, settings?: EquipmentSettings): number {
  if (timed) return 0;
  if (isAssisted(settings)) return bodyWeightKg == null ? 0 : Math.round(Math.max(0, bodyWeightKg - weightKg) * reps * 100) / 100;
  const body = equipment === "bodyweight" && bodyWeightKg != null && Number.isFinite(bodyWeightKg) && bodyWeightKg > 0 ? bodyWeightKg : 0;
  return Math.round((body + weightKg * (equipment === "dumbbell" ? settings?.dumbbellCount ?? 1 : 1)) * reps * 100) / 100;
}

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
  if (isAssisted(set as MeasuredSet)) return `Противовес ${set.weightKg.toLocaleString("ru-RU")} кг × ${set.reps}`;
  if ((set as MeasuredSet).dumbbellCount === 2) return `2 × ${set.weightKg.toLocaleString("ru-RU")} кг × ${set.reps}`;
  if (set.weightKg === 0) return `${set.reps} повт.`;
  return `${set.weightKg.toLocaleString("ru-RU")} кг × ${set.reps}`;
}

export function formatSetContext(set: WorkoutSet): string {
  const recorded = set as MeasuredSet;
  const body = (recorded.equipment === "bodyweight" || isAssisted(recorded)) && recorded.durationSeconds == null
    ? recorded.bodyWeightKg != null ? `Вес тела ${recorded.bodyWeightKg.toLocaleString("ru-RU")} кг${recorded.bodyWeightEstimated ? " (расчётный)" : ""}` : "Вес тела не указан; тоннаж неполный" : null;
  return [body, isAssisted(recorded) ? `Расчётная нагрузка ${recorded.effectiveWeightKg ?? 0} кг` : null, recorded.rir != null ? `Запас ${recorded.rir === 5 ? "5+" : recorded.rir}` : null, recorded.technique === "good" ? "техника сохранена" : recorded.technique === "breakdown" ? "техника нарушалась" : null].filter(Boolean).join(" · ");
}
