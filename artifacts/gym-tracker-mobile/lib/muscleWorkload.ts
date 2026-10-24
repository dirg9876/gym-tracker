import { exerciseAnatomy, MUSCLES, type Muscle } from "./exerciseAnatomy";
import { weeklySets } from "./trainingCoach";

type Row = { exerciseName: string; muscleGroup: string; createdAt: string; workoutStartedAt?: string; workoutFinishedAt?: string; reps: number; durationSeconds?: number };
export function weeklyMuscleWorkload(sets: Row[], now = new Date()) {
  const muscles = new Map<Muscle, { muscle: Muscle; label: string; direct: number; indirect: number; holds: number; dates: Set<string> }>();
  let unspecifiedSets = 0;
  for (const set of weeklySets(sets, now)) {
    if (!(set.reps > 0 || (set.durationSeconds ?? 0) > 0)) continue;
    const info = exerciseAnatomy({ name: set.exerciseName, muscleGroup: set.muscleGroup });
    if (!info.specific) { unspecifiedSets++; continue; }
    for (const [role, ids] of [["direct", info.primary], ["indirect", info.secondary]] as const) {
      for (const muscle of new Set(ids)) {
        const item = muscles.get(muscle) ?? { muscle, label: MUSCLES[muscle], direct: 0, indirect: 0, holds: 0, dates: new Set<string>() };
        if ((set.durationSeconds ?? 0) > 0) item.holds++; else item[role]++;
        const date = new Date(set.workoutStartedAt ?? set.createdAt);
        item.dates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
        muscles.set(muscle, item);
      }
    }
  }
  return { unspecifiedSets, muscles: [...muscles.values()].map(({ dates, ...item }) => ({ ...item, days: dates.size,
    estimatedSets: item.direct + item.indirect * 0.5 })).sort((a, b) => b.estimatedSets - a.estimatedSets || a.label.localeCompare(b.label, "ru")) };
}
export type MuscleWorkload = ReturnType<typeof weeklyMuscleWorkload>;
