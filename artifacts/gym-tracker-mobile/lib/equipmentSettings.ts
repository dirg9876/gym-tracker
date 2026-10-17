import { z } from "zod";
import type { Exercise, Equipment } from "@workspace/api-client-react";

export const equipmentSettingsSchema = z.object({
  weightStepKg: z.number().finite().min(0.25).max(20).optional(),
  loadMode: z.enum(["weight", "assisted"]).optional(),
  dumbbellCount: z.union([z.literal(1), z.literal(2)]).optional(),
});
export type EquipmentSettings = z.infer<typeof equipmentSettingsSchema>;
export type ConfiguredExercise = Exercise & EquipmentSettings;

export function validEquipmentSettings(exercise: { equipment: Equipment; name: string } & EquipmentSettings): boolean {
  return equipmentSettingsSchema.safeParse({ weightStepKg: exercise.weightStepKg, loadMode: exercise.loadMode, dumbbellCount: exercise.dumbbellCount }).success
    && (exercise.loadMode !== "assisted" || exercise.equipment === "machine" && !/^(боковая )?планка$/i.test(exercise.name.trim()))
    && (exercise.dumbbellCount == null || exercise.equipment === "dumbbell");
}

export const isAssisted = (exercise?: object | null) => (exercise as EquipmentSettings | null | undefined)?.loadMode === "assisted";
export const weightStep = (exercise?: EquipmentSettings | null) => exercise?.weightStepKg ?? 2.5;

export function weightPresets(exercise?: { equipment: Equipment } & EquipmentSettings, bodyWeightKg?: number | null): number[] {
  const min = exercise?.equipment === "barbell" || !exercise ? 20 : 0;
  const step = weightStep(exercise);
  const values = isAssisted(exercise) ? [0, 10, 20, 30, 40] : exercise?.equipment === "bodyweight" ? [0, 5, 10, 15, 20] : exercise?.equipment === "dumbbell" ? [2.5, 5, 10, 15, 20] : [20, 40, 60, 80, 100];
  return [...new Set(values.map(value => +(min + Math.round((value - min) / step) * step).toFixed(2)))].filter(value => !isAssisted(exercise) || bodyWeightKg == null || value <= bodyWeightKg);
}

export function performanceWeight(set: { weightKg: number; loadMode?: string; effectiveWeightKg?: number }): number {
  return set.loadMode === "assisted" ? set.effectiveWeightKg ?? 0 : set.weightKg;
}
