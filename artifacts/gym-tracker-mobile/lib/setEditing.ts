import { z } from "zod";
import type { MeasuredSet } from "./workoutMeasurement";

export const setValuesSchema = z.object({
  weightKg: z.number().finite().nonnegative(), reps: z.number().int().nonnegative().safe(),
  durationSeconds: z.number().int().min(1).max(86400).optional(),
  rir: z.number().int().min(0).max(5).nullable(), technique: z.enum(["good", "breakdown"]).nullable(),
}).strict();
export const setEditSchema = z.object({ revision: z.number().int().nonnegative().safe(), values: setValuesSchema }).strict();
export type SetValues = z.infer<typeof setValuesSchema>;
export type EditableSet = MeasuredSet & { revision?: number; editedAt?: string };
export function setValues(set: { weightKg: number; reps: number; durationSeconds?: number; rir?: number | null; technique?: "good" | "breakdown" | null }): SetValues {
  return { weightKg: set.weightKg, reps: set.reps, ...(set.durationSeconds != null ? { durationSeconds: set.durationSeconds } : {}), rir: set.rir ?? null, technique: set.technique ?? null };
}
export function equalSetValues(a: SetValues, b: SetValues) {
  return a.weightKg === b.weightKg && a.reps === b.reps && a.durationSeconds === b.durationSeconds && a.rir === b.rir && a.technique === b.technique;
}
