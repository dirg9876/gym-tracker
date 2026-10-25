import type { EquipmentSettings } from "./equipmentSettings";
import { isAssisted } from "./equipmentSettings";
import { formatKg } from "./format";
import { plannedSet, type TemplateExercise } from "./workoutTemplates";

export function planExerciseLines(exercise: TemplateExercise, settings?: EquipmentSettings): string[] {
  const groups: { label: string; count: number }[] = [];
  for (let index = 0; index < exercise.sets; index++) {
    const target = plannedSet(exercise, index);
    const load = isAssisted(settings) ? `противовес ${formatKg(target.weightKg)}`
      : exercise.equipment === "bodyweight" ? target.weightKg > 0 ? `+${formatKg(target.weightKg)}` : "свой вес"
      : `${formatKg(target.weightKg)}${exercise.equipment === "dumbbell" ? " на гантель" : ""}`;
    const label = target.durationSeconds != null ? `${target.durationSeconds} с` : `${load} × ${target.reps}`;
    const last = groups.at(-1);
    if (last?.label === label) last.count++;
    else groups.push({ label, count: 1 });
  }
  return groups.map(group => `${group.count} подх. · ${group.label}`);
}
