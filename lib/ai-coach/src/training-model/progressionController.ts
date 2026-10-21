import { predictReps, predictWeight, roundWeightDown } from "./repPredictor.ts";

export type LoadGuard = { weightKg: number; reps: number; action: "calibrate" | "hold" | "progress_reps" | "increase" | "reduce"; reason: string };
export function controlPrediction(input: {
  strengthKg: number | null; guard: LoadGuard; repsMin: number; targetRir: number;
  stepKg: number; minimumKg: number; fatigueReps?: number;
}) {
  const { guard, strengthKg, fatigueReps = 0 } = input;
  if (strengthKg == null || guard.action === "calibrate") return { ...guard, predictedReps: null, unroundedWeightKg: null };
  const unroundedWeightKg = predictWeight(strengthKg, Math.min(input.repsMin, guard.reps), input.targetRir, fatigueReps);
  if (unroundedWeightKg == null) return { ...guard, predictedReps: null, unroundedWeightKg: null };
  // The formula may reduce a target, but can never authorize a progression itself.
  const weightKg = Math.min(guard.weightKg, roundWeightDown(unroundedWeightKg, input.stepKg, input.minimumKg)!);
  const predictedReps = predictReps(strengthKg, weightKg, input.targetRir, fatigueReps);
  const reps = Math.max(1, Math.min(guard.reps, Math.floor((predictedReps ?? guard.reps) + 1e-8)));
  const changed = weightKg < guard.weightKg || reps < guard.reps;
  return { weightKg, reps, action: changed ? (weightKg < guard.weightKg ? "reduce" as const : "hold" as const) : guard.action,
    reason: changed ? "Расчёт при целевом запасе ограничил нагрузку. Это приближённый прогноз; проверьте его по первому подходу." : guard.reason,
    predictedReps, unroundedWeightKg };
}
