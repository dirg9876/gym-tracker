import { z } from "zod";
import { roundWeightDown } from "@workspace/ai-coach";

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

// An equipment quantum is not a universal 2.5 kg ceiling. Percentages are a programming guard, not an individual optimum.
export function progressionIncrement(weightKg: number, stepKg: number, clearlyEasy = false, equipment = "barbell"): number | null {
  if (!Number.isFinite(weightKg) || weightKg < 0 || !Number.isFinite(stepKg) || stepKg <= 0) return null;
  if ((stepKg > 2.5 || equipment !== "barbell") && (weightKg <= 0 || stepKg > weightKg * 0.1 + 1e-8)) return null;
  const steps = clearlyEasy && weightKg > 0 ? Math.max(1, Math.min(2, Math.floor((weightKg * 0.1 + 1e-8) / stepKg))) : 1;
  return Math.round(stepKg * steps * 100) / 100;
}

export function workingBaseline<T extends { workoutId?: number; weightKg: number; reps: number; durationSeconds?: number }>(history: T[], current: T[], repsMin: number): T | undefined {
  if (current.length) return current.filter(row => row.durationSeconds == null && row.reps >= repsMin && row.reps <= 30).at(-1) ?? current.at(-1);
  const session = history.filter(row => row.workoutId === history.at(-1)?.workoutId);
  // Back-off sets reflect within-session fatigue, not a weaker fresh-session starting load.
  const highest = (rows: T[]) => rows.reduce<T | undefined>((best, row) => !best || row.weightKg > best.weightKg ? row : best, undefined);
  return highest(session.filter(row => row.durationSeconds == null && row.reps >= repsMin && row.reps <= 30))
    ?? highest(session.filter(row => row.durationSeconds == null && row.reps >= Math.min(8, repsMin) && row.reps < repsMin))
    ?? history.filter(row => row.durationSeconds == null && row.reps >= repsMin && row.reps <= 30).at(-1) ?? session[0];
}

export function assessedProbe(row: RecordedSet | undefined, repsMin: number, targetRir: number, bodyweight: boolean) {
  if (!row || row.durationSeconds != null || row.technique !== "good" || row.rir == null || row.rir < targetRir || row.reps >= repsMin || row.reps < (bodyweight ? 1 : Math.min(8, repsMin))) return null;
  const reps = bodyweight ? Math.min(repsMin, row.reps + Number(row.rir > targetRir))
    : row.rir <= 3 ? repsMin : Math.min(repsMin, row.reps + row.rir - targetRir);
  return { weightKg: row.weightKg, reps, action: reps < repsMin ? "calibrate" as const : "hold" as const,
    reason: bodyweight ? "Короткий подход уже оценён: повторения подобраны по выполненному подходу и запасу, без сброса к трём и без добавленного веса." : "Подборочный подход уже выполнен. Сохраняем измеренный вес; переход в рабочий диапазон проверяется запасом повторений и расчётом, не новым стартом с минимального веса." };
}

export function returnAfterBreak(row: { weightKg: number; reps: number }, step: number, minimumKg: number, repsMin: number, bodyweight: boolean) {
  return { weightKg: bodyweight ? 0 : roundWeightDown(Math.max(minimumKg, row.weightKg * 0.9), step, minimumKg)!,
    reps: bodyweight ? Math.min(row.reps, 3) : Math.min(8, repsMin), action: "calibrate" as const,
    reason: `Перерыв больше 28 дней: один облегчённый проверочный подход; затем укажите запас и технику. ${bodyweight ? "Дополнительное отягощение убрано до повторной оценки." : "Старый вес не назначается как подтверждённый рабочий. Снижение на 10% — правило приложения, не оценка потери силы."}` };
}

export function nextWorkingLoad(sets: RecordedSet[], goal: Goal, now = Date.now()) {
  const eligible = sets.filter(set => set.exerciseId === goal.exerciseId && set.durationSeconds == null).sort((a, b) => (a.workoutFinishedAt ?? a.createdAt).localeCompare(b.workoutFinishedAt ?? b.createdAt) || a.createdAt.localeCompare(b.createdAt));
  const latest = eligible.at(-1);
  if (!latest) return { weightKg: null, increase: false, reason: "Нет записанных рабочих подходов" };
  const session = eligible.filter(set => set.workoutId === latest.workoutId);
  const previousId = eligible.filter(set => set.workoutId !== latest.workoutId).at(-1)?.workoutId;
  const previous = previousId == null ? [] : eligible.filter(set => set.workoutId === previousId);
  const success = (rows: RecordedSet[]) => rows.length === goal.sets && rows.every((set, i) => set.weightKg === session[i]?.weightKg && set.reps >= goal.repsMax && set.technique === "good" && set.rir != null && set.rir >= Math.max(2, goal.targetRir ?? 2));
  const step = goal.weightStepKg ?? (goal.equipment === "dumbbell" ? 1 : 2.5);
  const baseline = workingBaseline(session, [], goal.repsMin) ?? session[0];
  const clearlyEasy = [...session, ...previous].every(set => set.rir != null && set.rir >= Math.max(4, (goal.targetRir ?? 2) + 2));
  const increment = progressionIncrement(baseline.weightKg, step, clearlyEasy, goal.equipment);
  const date = (set: RecordedSet) => Date.parse(set.workoutFinishedAt ?? set.createdAt);
  const recent = now >= date(latest) && now - date(latest) <= 28 * 86400000 && previous.length > 0 && date(latest) - date(previous.at(-1)!) <= 28 * 86400000;
  const increase = goal.equipment !== "bodyweight" && latest.workoutId != null && recent && success(session) && success(previous) && increment != null;
  const weightKg = Math.round((baseline.weightKg + (increase ? increment! : 0)) * 100) / 100;
  return { weightKg, increase, reason: increase ? `Верх диапазона (${goal.repsMax}) повторён во всех ${goal.sets} подходах двух тренировок с запасом и техникой. Прибавка ${increment} кг${clearlyEasy && increment! > step ? " (два шага при большом запасе, не более 10%)" : ""}; вернитесь к ${goal.repsMin} повт.` : session.some(set => set.technique === "breakdown") ? "Без повышения. При нарушении техники уменьшите нагрузку или смените вариант упражнения" : goal.equipment === "bodyweight" ? `Сохраняйте добавленный вес и технику. Повторы растут только до ${goal.repsMax}; новое отягощение требует отдельной оценки, не формулы штанги.` : increment == null ? "Шаг оборудования превышает 10% рабочего веса. Нужен меньший шаг или ручное подтверждение нагрузки." : latest.reps >= goal.repsMax ? `Не превышайте ${goal.repsMax} повт. Удерживайте вес: для прибавки нужны два полных сопоставимых занятия по ${goal.sets} подхода с запасом и сохранённой техникой.` : `Повторы растут только до ${goal.repsMax}. Для прибавки веса нужны два полных сопоставимых занятия с запасом и сохранённой техникой.` };
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
