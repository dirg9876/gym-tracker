import { predictWeight, qualityEstimate, roundWeightDown } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { sameLoadCategory, minimumWeight } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";

// Conservative calibration heuristics, not validated individual strength ratios.
const pairs = [
  ["Жим гантелей лёжа", "Жим штанги лёжа", 0.3],
  ["Жим штанги лёжа", "Жим гантелей лёжа", 1.5],
  ["Жим штанги на наклонной скамье", "Жим штанги лёжа", 0.7],
  ["Жим гантелей на наклонной скамье", "Жим гантелей лёжа", 0.7],
  ["Жим гантелей сидя", "Жим штанги стоя", 0.3],
  ["Жим штанги стоя", "Жим гантелей сидя", 1.5],
  ["Тяга гантели одной рукой", "Тяга штанги в наклоне", 0.3],
  ["Сгибания с гантелями", "Подъём штанги на бицепс", 0.3],
  ["Молотки с гантелями", "Сгибания с гантелями", 0.75],
] as const;
export function relatedCalibration(state: OfflineState, exerciseId: number, now: number, reps: number, stepKg: number) {
  const target = state.exercises.find(ex => ex.id === exerciseId);
  if (!target || isAssisted(target) || !["barbell", "dumbbell"].includes(target.equipment)) return null;
  const dates = new Map(state.workouts.filter(w => w.finishedAt && Date.parse(w.finishedAt) <= now && now - Date.parse(w.finishedAt) <= 28 * 86400000).map(w => [w.id, w.finishedAt!]));
  for (const [to, from, coefficient] of pairs) {
    if (target.name !== to) continue;
    const source = state.exercises.find(ex => ex.name === from && !ex.deletedAt && !isAssisted(ex) && ["barbell", "dumbbell"].includes(ex.equipment));
    if (!source) continue;
    if (target.equipment !== (/гантел/i.test(to) ? "dumbbell" : "barbell") || source.equipment !== (/гантел/i.test(from) ? "dumbbell" : "barbell")) continue;
    const rows = state.sets.filter(s => dates.has(s.workoutId) && s.exerciseId === source.id && sameLoadCategory(s, source) && (source.equipment !== "dumbbell" || (s.dumbbellCount ?? 1) === (source.dumbbellCount ?? 1))).sort((a, b) => dates.get(a.workoutId)!.localeCompare(dates.get(b.workoutId)!) || a.workoutId - b.workoutId || a.id - b.id);
    const session = rows.filter(s => s.workoutId === rows.at(-1)?.workoutId);
    if (session.some(s => s.rir === 0 || s.technique === "breakdown")) continue;
    const observed = session.filter(s => s.durationSeconds == null && s.reps >= 6 && s.reps <= 15 && s.weightKg >= Math.max(0.25, minimumWeight(source.equipment))).sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0];
    if (!observed) continue;
    const reserve = observed.rir != null && observed.rir >= 2 && observed.technique === "good";
    const estimate = qualityEstimate(observed);
    const sourceWeight = Math.min(observed.weightKg, estimate ? predictWeight(estimate, reps, 2)! : observed.weightKg);
    const effectiveCoefficient = coefficient * (reserve ? 1 : 0.75);
    const weightKg = roundWeightDown(sourceWeight * effectiveCoefficient, stepKg, minimumWeight(target.equipment))!;
    return { exerciseId, weightKg, reps, sourceExerciseId: source.id, coefficient: effectiveCoefficient,
      reason: `Подбор по аналогу «${source.name}»: ${observed.weightKg} кг × ${observed.reps}, коэффициент ${effectiveCoefficient.toFixed(3)}${target.equipment === "dumbbell" ? " на одну гантель" : ""}. Это предварительная оценка, не подтверждённый рабочий вес. После первого подхода оцените запас и технику.` };
  }
  return null;
}
