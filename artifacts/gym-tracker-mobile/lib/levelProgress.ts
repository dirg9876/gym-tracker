import type { Equipment, LevelsResponse, MainExerciseStat } from "@workspace/api-client-react";
import type { ExerciseStandard } from "./exerciseStandards";
import type { EquipmentSettings } from "./equipmentSettings";

export type LevelExerciseStat = MainExerciseStat & Pick<EquipmentSettings, "loadMode"> & {
  standard: ExerciseStandard; bestValue: number; requiredValueForNextLevel: number | null;
  hasRecordedResult: boolean; achievedLevel: number;
  archived: boolean;
};
export type ExerciseLevelsResponse = Omit<LevelsResponse, "stats"> & {
  stats: Omit<LevelsResponse["stats"], "mainExercises"> & { mainExercises: LevelExerciseStat[] };
};

export function targetForExerciseLevel(standard: ExerciseStandard, equipment: Equipment, level: number): number {
  if (level <= 0) return 0;
  const step = standard.unit === "kg" ? 2.5 : standard.unit === "seconds" ? 5 : 1;
  const start = standard.unit === "kg" && equipment === "barbell" ? 20 : step;
  const anchors = [{ level: 1, target: start }, ...standard.entries.map(entry => ({ level: entry.rank.minLevel, target: entry.target }))];
  const at = Math.min(80, level);
  const index = anchors.findIndex(anchor => anchor.level >= at);
  if (index <= 0) return start;
  const lower = anchors[index - 1], upper = anchors[index];
  const value = lower.target + (upper.target - lower.target) * (at - lower.level) / (upper.level - lower.level);
  return Math.max(start, Math.ceil(value / step - 1e-9) * step);
}

export function achievedExerciseLevel(standard: ExerciseStandard, equipment: Equipment, best: number, recorded: boolean): number {
  if (!recorded) return 0;
  for (let level = 80; level > 0; level--) if (best >= targetForExerciseLevel(standard, equipment, level)) return level;
  return 0;
}

export function levelFromExercises(exercises: Pick<LevelExerciseStat, "exerciseId" | "achievedLevel">[]): number {
  const levels = new Map<number, number>();
  for (const exercise of exercises) levels.set(exercise.exerciseId, Math.max(levels.get(exercise.exerciseId) ?? 0, exercise.achievedLevel));
  return [...levels.values()].sort((a, b) => b - a)[2] ?? 0;
}

export function isExercisePassed(exercise: MainExerciseStat | LevelExerciseStat, _bodyWeightKg?: number): boolean {
  if ("bestValue" in exercise) return exercise.hasRecordedResult && exercise.requiredValueForNextLevel != null && exercise.bestValue >= exercise.requiredValueForNextLevel;
  return exercise.requiredKgForNextLevel != null && exercise.maxWeightKg >= exercise.requiredKgForNextLevel;
}

export function exerciseLevelGoal(exercise: LevelExerciseStat, level: number) {
  const target = targetForExerciseLevel(exercise.standard, exercise.equipment, level);
  const remaining = exercise.hasRecordedResult ? Math.max(0, Math.round((target - exercise.bestValue) * 100) / 100) : null;
  return { target, remaining, passed: remaining === 0 };
}
