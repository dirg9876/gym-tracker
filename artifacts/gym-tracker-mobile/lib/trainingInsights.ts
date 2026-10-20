import type { Exercise } from "@workspace/api-client-react";
import type { MeasuredSet } from "./workoutMeasurement";
import { isTimedExercise } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";

export type InsightPeriod = 28 | 84 | null;
type Session = { id: number; startedAt: string; finishedAt?: string | null };
export type InsightPoint = { date: string; value: number; workoutId: number; set: MeasuredSet };
export type InsightSeries = { id: "weight" | "assistance" | "reps" | "seconds"; label: string; unit: "kg" | "reps" | "seconds"; lowerIsBetter: boolean; points: InsightPoint[] };
export type InsightExercise = { exercise: Exercise; sets: number; defaultMetric: InsightSeries["id"]; series: InsightSeries[]; unknownTimeSets: number };

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const offsetDay = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const monday = (date: Date) => offsetDay(date, -((date.getDay() + 6) % 7));
const countDays = (sessions: Session[]) => new Set(sessions.map(row => localDateKey(new Date(row.startedAt)))).size;

export function buildTrainingInsights(workouts: Session[], sets: MeasuredSet[], exercises: Exercise[], period: InsightPeriod = 28, now = new Date()) {
  if (![28, 84, null].includes(period) || !Number.isFinite(now.getTime())) throw new Error("Invalid insights period/date");
  const today = midnight(now);
  const start = period == null ? null : offsetDay(today, 1 - period);
  // Use the same session date as History. Future/corrupt sessions cannot invent activity.
  const finished = workouts.filter(row => row.finishedAt && Number.isFinite(Date.parse(row.startedAt)) && Number.isFinite(Date.parse(row.finishedAt))
    && Date.parse(row.startedAt) <= Date.parse(row.finishedAt) && Date.parse(row.finishedAt) <= now.getTime());
  const current = finished.filter(row => !start || Date.parse(row.startedAt) >= start.getTime());
  const selectedIds = new Set(current.map(row => row.id));
  const sessionById = new Map(current.map(row => [row.id, row]));
  const selectedSets = sets.filter(row => selectedIds.has(row.workoutId));
  const previous = start && period ? finished.filter(row => Date.parse(row.startedAt) >= offsetDay(start, -period).getTime() && Date.parse(row.startedAt) < start.getTime()) : null;
  const previousIds = new Set(previous?.map(row => row.id));
  const previousSets = sets.filter(row => previousIds.has(row.workoutId));
  const calendarStart = start ?? offsetDay(today, -83);
  const byDay = new Map<string, { workouts: number; sets: number }>();
  for (const session of current) {
    const key = localDateKey(new Date(session.startedAt));
    const bucket = byDay.get(key) ?? { workouts: 0, sets: 0 };
    bucket.workouts++;
    byDay.set(key, bucket);
  }
  const groupMap = new Map<string, { muscleGroup: string; sets: number; days: Set<string> }>();
  const setsByExercise = new Map<number, MeasuredSet[]>();
  for (const set of selectedSets) {
    const session = sessionById.get(set.workoutId)!;
    const key = localDateKey(new Date(session.startedAt));
    byDay.get(key)!.sets++;
    const group = groupMap.get(set.muscleGroup) ?? { muscleGroup: set.muscleGroup, sets: 0, days: new Set<string>() };
    group.sets++; group.days.add(key); groupMap.set(set.muscleGroup, group);
    const rows = setsByExercise.get(set.exerciseId) ?? [];
    rows.push(set); setsByExercise.set(set.exerciseId, rows);
  }
  const calendar = [];
  for (let date = calendarStart; date <= today; date = offsetDay(date, 1)) {
    const key = localDateKey(date);
    calendar.push({ date: key, ...(byDay.get(key) ?? { workouts: 0, sets: 0 }) });
  }
  const weeks = [];
  for (let date = monday(calendarStart); date <= today; date = offsetDay(date, 7)) {
    const from = date < calendarStart ? calendarStart : date;
    const end = offsetDay(date, 6);
    const to = end > today ? today : end;
    const days = calendar.filter(row => row.date >= localDateKey(from) && row.date <= localDateKey(to));
    weeks.push({ date: localDateKey(date), from: localDateKey(from), to: localDateKey(to), partial: date < calendarStart || end > today,
      sets: days.reduce((sum, row) => sum + row.sets, 0), workouts: days.reduce((sum, row) => sum + row.workouts, 0) });
  }
  const exerciseById = new Map(exercises.map(row => [row.id, row]));
  const exerciseInsights: InsightExercise[] = [];
  for (const [exerciseId, rows] of setsByExercise) {
    const exercise = exerciseById.get(exerciseId);
    if (!exercise) continue;
    const bySession = new Map<number, MeasuredSet[]>();
    for (const row of rows) { const batch = bySession.get(row.workoutId) ?? []; batch.push(row); bySession.set(row.workoutId, batch); }
    const timed = isTimedExercise(exercise.name);
    const definitions: Omit<InsightSeries, "points">[] = timed
      ? [{ id: "seconds", label: "Лучшее удержание", unit: "seconds", lowerIsBetter: false }]
      : [
        { id: "weight", label: exercise.equipment === "bodyweight" ? "Дополнительный вес" : exercise.equipment === "dumbbell" ? "Вес одной гантели" : "Максимальный вес", unit: "kg", lowerIsBetter: false },
        { id: "assistance", label: "Минимальный противовес", unit: "kg", lowerIsBetter: true },
        { id: "reps", label: "Повторы за один подход", unit: "reps", lowerIsBetter: false },
      ];
    const series = definitions.map(definition => {
      const points: InsightPoint[] = [];
      for (const [workoutId, batch] of bySession) {
        const eligible = batch.filter(row => definition.id === "seconds" ? Number.isFinite(row.durationSeconds) && (row.durationSeconds ?? 0) > 0
          : row.durationSeconds == null && Number.isFinite(row.reps) && row.reps > 0 && Number.isFinite(row.weightKg) && row.weightKg >= 0
            && (definition.id === "reps" || isAssisted(row) === (definition.id === "assistance")));
        const value = (row: MeasuredSet) => definition.id === "seconds" ? row.durationSeconds! : definition.id === "reps" ? row.reps : row.weightKg;
        const best = eligible.sort((a, b) => (definition.lowerIsBetter ? value(a) - value(b) : value(b) - value(a)) || b.reps - a.reps || a.id - b.id)[0];
        if (best) points.push({ workoutId, date: sessionById.get(workoutId)!.startedAt, value: value(best), set: { ...best } });
      }
      points.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.workoutId - b.workoutId);
      return { ...definition, points };
    }).filter(row => row.points.length && !(exercise.equipment === "bodyweight" && row.id === "weight" && row.points.every(point => point.value === 0)));
    exerciseInsights.push({ exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, isCustom: exercise.isCustom, isMain: exercise.isMain },
      sets: rows.length, series,
      defaultMetric: timed ? "seconds" : exercise.equipment === "bodyweight" ? "reps" : series.some(row => row.id === "assistance") && !series.some(row => row.id === "weight") ? "assistance" : "weight",
      unknownTimeSets: timed ? rows.filter(row => !(row.durationSeconds != null && row.durationSeconds > 0)).length : 0 });
  }
  exerciseInsights.sort((a, b) => b.sets - a.sets || a.exercise.name.localeCompare(b.exercise.name, "ru"));
  return { period, from: start ? localDateKey(start) : null, to: localDateKey(today),
    totals: { workouts: current.length, sets: selectedSets.length, days: countDays(current) },
    previous: previous ? { workouts: previous.length, sets: previousSets.length, days: countDays(previous) } : null,
    calendar, weeks, groups: [...groupMap.values()].map(row => ({ muscleGroup: row.muscleGroup, sets: row.sets, days: row.days.size })).sort((a, b) => b.sets - a.sets || a.muscleGroup.localeCompare(b.muscleGroup, "ru")),
    exercises: exerciseInsights };
}

export type TrainingInsights = ReturnType<typeof buildTrainingInsights>;
