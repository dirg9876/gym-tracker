import type { Exercise, ExerciseRankNorms, Profile } from "@workspace/api-client-react";
import { exerciseStandard, standardProgress, type RankedExercise } from "./exerciseStandards";

export function nextRankHint(norms: Pick<ExerciseRankNorms, "mcKg" | "rankNorms"> | undefined, selectedWeightKg: number) {
  if (!norms?.mcKg || !Number.isFinite(selectedWeightKg) || selectedWeightKg < 0) return null;
  const entries = norms.rankNorms.filter(entry => entry.kgTarget > 0).sort((a, b) => a.kgTarget - b.kgTarget);
  const next = entries.find(entry => entry.kgTarget > selectedWeightKg);
  const target = next ?? entries.at(-1);
  if (!target) return null;
  return { ...target, remainingKg: Math.max(0, Math.round((target.kgTarget - selectedWeightKg) * 100) / 100), atMaximum: !next };
}

export function exerciseRankHint(exercise: RankedExercise | undefined, profile: Profile | undefined, value = exercise?.rankBest ?? exercise?.userMaxKg ?? 0) {
  if (!exercise || !profile) return null;
  return standardProgress(exerciseStandard(exercise, profile), value);
}
