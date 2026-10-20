import type { Exercise } from "@workspace/api-client-react";
import type { EquipmentSettings } from "./equipmentSettings";
import { isAssisted } from "./equipmentSettings";
import { isTimedExercise } from "./workoutMeasurement";

export type CatalogExercise = Exercise & EquipmentSettings & { replacementPending?: boolean };
export type ExerciseMaintenance = { exercise: CatalogExercise; recordedSets: number; requiresReplacement: boolean };

export function canReplaceExercise(source: CatalogExercise, target: CatalogExercise): boolean {
  return source.id !== target.id && source.equipment === target.equipment
    && isTimedExercise(source.name) === isTimedExercise(target.name)
    && isAssisted(source) === isAssisted(target)
    && (source.equipment !== "dumbbell" || (source.dumbbellCount ?? 1) === (target.dumbbellCount ?? 1));
}

type CatalogReferences = { sets: { exerciseId: number }[]; coachMonth?: { plan: { templates: { exercises: { exerciseId: number }[] }[] } } };

export function requiresExerciseReplacement(state: CatalogReferences, id: number): boolean {
  return state.sets.some(set => set.exerciseId === id)
    || !!state.coachMonth?.plan.templates.some(plan => plan.exercises.some(ex => ex.exerciseId === id));
}

// Old tombstones without results can go; recorded movements need an explicit user choice.
export function migrateExerciseCatalog<T extends { id: number; deletedAt?: string; replacementPending?: boolean }>(state: CatalogReferences & { exercises: T[] }): boolean {
  let changed = false;
  state.exercises = state.exercises.filter(exercise => {
    if (!exercise.deletedAt) return true;
    changed = true;
    if (!requiresExerciseReplacement(state, exercise.id)) return false;
    delete exercise.deletedAt;
    exercise.replacementPending = true;
    return true;
  });
  return changed;
}
