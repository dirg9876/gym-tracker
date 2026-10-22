import { predictReps, predictWeight, roundWeightDown } from "./repPredictor.ts";

export type LoadGuard = { weightKg: number; reps: number; action: "calibrate" | "hold" | "progress_reps" | "increase" | "reduce"; reason: string };
export function controlPrediction(input: {
  strengthKg: number | null; guard: LoadGuard; repsMin: number; repsMax: number; targetRir: number;
  stepKg: number; minimumKg: number; fatigueReps?: number;
}) {
  const { strengthKg, fatigueReps = 0 } = input;
  const limited = input.guard.reps > input.repsMax;
  const guard = { ...input.guard, reps: Math.min(input.guard.reps, input.repsMax),
    action: limited && input.guard.action === "progress_reps" ? "hold" as const : input.guard.action,
    reason: limited ? `Верхняя граница ${input.repsMax} повт. достигнута. Сохраните диапазон; прибавка веса требует подтверждённых подходов с запасом и техникой.` : input.guard.reason };
  if (guard.weightKg < input.minimumKg) return { weightKg: input.minimumKg, reps: Math.min(input.repsMax, 8, Math.max(input.repsMin, guard.reps)), action: "calibrate" as const,
    reason: "Старый вес ниже массы грифа. Начните с подборочного подхода с грифом 20 кг; историческая запись не изменена.", predictedReps: null, unroundedWeightKg: null };
  // The lower repetition bound is a hard constraint for automatic prescriptions.
  // Without a trustworthy strength estimate, a single cannot become a working set.
  const shortProbe = guard.action === "calibrate" && guard.reps >= Math.min(8, input.repsMin);
  if (guard.action !== "reduce" && !shortProbe && guard.reps < input.repsMin && (strengthKg == null || guard.action === "calibrate")) {
    const calibrationKg = Math.max(input.minimumKg, input.stepKg);
    return { weightKg: Math.min(guard.weightKg, calibrationKg), reps: Math.min(8, input.repsMin),
      action: "calibrate" as const, reason: "Нет достоверного рабочего подхода в целевом диапазоне. Нужен подборочный подход, а не повторение тяжёлого сингла.",
      predictedReps: null, unroundedWeightKg: null };
  }
  if (strengthKg == null || guard.action === "calibrate") return { ...guard, predictedReps: null, unroundedWeightKg: null };
  const unroundedWeightKg = predictWeight(strengthKg, input.repsMin, input.targetRir, fatigueReps);
  if (unroundedWeightKg == null) return { ...guard, predictedReps: null, unroundedWeightKg: null };
  // The formula may reduce a target, but can never authorize a progression itself.
  const weightKg = Math.min(guard.weightKg, roundWeightDown(unroundedWeightKg, input.stepKg, input.minimumKg)!);
  const predictedReps = predictReps(strengthKg, weightKg, input.targetRir, fatigueReps);
  // If the estimate cannot support the requested lower bound even at the
  // minimum available load, request calibration instead of prescribing 1 rep.
  if (predictedReps != null && predictedReps + 1e-8 < input.repsMin) {
    return { weightKg, reps: input.repsMin, action: "calibrate" as const,
      reason: "Оценка силы не подтверждает заданный диапазон. Проверьте облегчённый вес и запас повторений.",
      predictedReps, unroundedWeightKg };
  }
  const reps = Math.min(input.repsMax, Math.max(input.repsMin, Math.min(Math.max(guard.reps, input.repsMin), Math.floor((predictedReps ?? guard.reps) + 1e-8))));
  const changed = weightKg < guard.weightKg || reps < guard.reps;
  return { weightKg, reps, action: changed ? (weightKg < guard.weightKg ? "reduce" as const : "hold" as const) : guard.action,
    reason: changed ? "Расчёт при целевом запасе ограничил нагрузку. Это приближённый прогноз; проверьте его по первому подходу." : guard.reason,
    predictedReps, unroundedWeightKg };
}
