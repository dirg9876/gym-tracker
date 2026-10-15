import { z } from "zod";

export const coachFieldsSchema = z.object({
  // Legacy tags remain importable; all approaches now count as working.
  setType: z.enum(["warmup", "working"]).optional(),
  rir: z.number().int().min(0).max(5).nullable().optional(),
  technique: z.enum(["good", "breakdown"]).nullable().optional(),
});
export type CoachFields = z.infer<typeof coachFieldsSchema>;
export const progressionSchema = z.object({
  weightStepKg: z.number().finite().min(0.25).max(20).optional(),
  targetRir: z.number().int().min(0).max(5).optional(),
});
export type Progression = z.infer<typeof progressionSchema>;

export const timerSchema = z.object({
  kind: z.enum(["rest", "plank"]),
  exerciseId: z.number().int().positive().safe().optional(),
  totalMs: z.number().int().min(1000).max(86400000),
  remainingMs: z.number().int().min(0).max(86400000),
  endsAt: z.number().int().positive().safe().nullable(),
}).refine(timer => timer.remainingMs <= timer.totalMs && (timer.kind !== "plank" || timer.exerciseId != null));
export type TrainingTimer = z.infer<typeof timerSchema>;

export function remainingMs(timer: TrainingTimer, now = Date.now()) {
  return timer.endsAt == null ? timer.remainingMs : Math.max(0, Math.min(timer.totalMs, timer.endsAt - now));
}
export function startTimer(kind: TrainingTimer["kind"], seconds: number, exerciseId?: number, now = Date.now()): TrainingTimer {
  return timerSchema.parse({ kind, exerciseId, totalMs: seconds * 1000, remainingMs: seconds * 1000, endsAt: now + seconds * 1000 });
}
export function pauseTimer(timer: TrainingTimer, now = Date.now()): TrainingTimer {
  return { ...timer, remainingMs: remainingMs(timer, now), endsAt: null };
}
export function resumeTimer(timer: TrainingTimer, now = Date.now()): TrainingTimer {
  return { ...timer, endsAt: now + timer.remainingMs };
}
export function extendTimer(timer: TrainingTimer, seconds: number, now = Date.now()): TrainingTimer {
  const left = remainingMs(timer, now) + seconds * 1000;
  return timerSchema.parse({ ...timer, totalMs: timer.totalMs + seconds * 1000, remainingMs: left, endsAt: timer.endsAt == null ? null : now + left });
}

type RecordedSet = CoachFields & { exerciseId: number; workoutId?: number; workoutFinishedAt?: string; createdAt: string; weightKg: number; reps: number; durationSeconds?: number };
type Goal = Progression & { exerciseId: number; sets: number; repsMin: number; repsMax: number; equipment: string };
export function nextWorkingLoad(sets: RecordedSet[], goal: Goal) {
  const eligible = sets.filter(set => set.exerciseId === goal.exerciseId && set.durationSeconds == null).sort((a, b) => (a.workoutFinishedAt ?? a.createdAt).localeCompare(b.workoutFinishedAt ?? b.createdAt) || a.createdAt.localeCompare(b.createdAt));
  const latest = eligible.at(-1);
  if (!latest) return { weightKg: null, increase: false, reason: "Нет записанных рабочих подходов" };
  const session = eligible.filter(set => set.workoutId === latest.workoutId);
  const sameLoad = session.length === goal.sets && session.every(set => set.weightKg === latest.weightKg);
  const quality = session.every(set => set.technique === "good" && set.rir != null && set.rir >= (goal.targetRir ?? 2));
  const increase = sameLoad && quality && session.every(set => set.reps >= goal.repsMax);
  const weightKg = Math.round((latest.weightKg + (increase ? (goal.weightStepKg ?? (goal.equipment === "dumbbell" ? 1 : 2.5)) : 0)) * 100) / 100;
  return { weightKg, increase, reason: increase ? "Верх диапазона выполнен во всех рабочих подходах, техника и запас отмечены" : session.some(set => set.technique === "breakdown") ? "Без повышения. При нарушении техники уменьшите нагрузку или смените вариант упражнения" : "Без повышения: не все условия прогрессии отмечены или выполнены" };
}

export function weeklyWork(sets: Array<RecordedSet & { muscleGroup: string }>, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const days = new Map<string, { working: number; days: Set<string> }>();
  for (const set of sets) {
    const date = new Date(set.createdAt);
    if (date.getTime() < start || date.getTime() >= end) continue;
    const group = days.get(set.muscleGroup) ?? { working: 0, days: new Set<string>() };
    group.working++;
    group.days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    days.set(set.muscleGroup, group);
  }
  return [...days].map(([muscleGroup, group]) => ({ muscleGroup, workingSets: group.working, trainingDays: group.days.size })).sort((a, b) => b.workingSets - a.workingSets || a.muscleGroup.localeCompare(b.muscleGroup));
}
