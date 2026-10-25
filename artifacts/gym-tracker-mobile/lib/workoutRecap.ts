import type { Workout } from "@workspace/api-client-react";
import type { OfflineState } from "./offlineApi";
import { isAssisted } from "./equipmentSettings";
import { formatKg } from "./format";
import { buildNextExercisePrediction } from "./trainingPrediction";
import { formatSeconds, isTimedExercise, setVolume, type MeasuredSet } from "./workoutMeasurement";

export type RecapExercise = {
  exerciseId: number; name: string; sets: number; best: MeasuredSet;
  previous: { date: string; best: MeasuredSet } | null;
  status: "first" | "record" | "improved" | "repeat" | "changed" | "attention";
  change: string; next: { result: string; reason: string } | null;
};
export type WorkoutRecap = {
  workout: Workout; exercises: RecapExercise[]; records: number; firstExercises: number;
  feedback: { repSets: number; rirKnown: number; breakdown: number; failure: number };
  groups: { name: string; sets: number }[]; elapsedMinutes: number | null; repetitions: number;
};

export function buildWorkoutRecap(state: OfflineState, workout: Workout, now = Date.now()): WorkoutRecap {
  const catalog = new Map(state.exercises.map(ex => [ex.id, ex]));
  const measured = (set: Workout["sets"][number]): MeasuredSet => ({ ...set, equipment: (set as MeasuredSet).equipment ?? catalog.get(set.exerciseId)?.equipment });
  const sets = workout.sets.map(measured);
  const unit = (set: MeasuredSet) => isTimedExercise(set.exerciseName) ? "seconds" : isAssisted(set) ? "assistance" : set.equipment === "bodyweight" ? "bodyweight" : `kg:${set.dumbbellCount ?? 1}`;
  const bestOf = (rows: MeasuredSet[]) => rows.reduce((best, row) => {
    if (isTimedExercise(row.exerciseName)) return (row.durationSeconds ?? 0) > (best.durationSeconds ?? 0) ? row : best;
    if (row.weightKg !== best.weightKg) return (isAssisted(row) ? row.weightKg < best.weightKg : row.weightKg > best.weightKg) ? row : best;
    return row.reps > best.reps ? row : best;
  });
  const started = Date.parse(workout.startedAt);
  const previousWorkouts = state.workouts.filter(w => w.finishedAt && Date.parse(w.finishedAt) <= Date.parse(workout.finishedAt!) && (Date.parse(w.startedAt) < started || Date.parse(w.startedAt) === started && w.id < workout.id));
  const previousById = new Map(previousWorkouts.map(w => [w.id, w]));
  const exercises = [...new Set(sets.map(set => set.exerciseId))].map(exerciseId => {
    const allCurrent = sets.filter(set => set.exerciseId === exerciseId), reference = allCurrent.at(-1)!;
    const current = allCurrent.filter(set => unit(set) === unit(reference)), best = bestOf(current);
    const pastRows = state.sets.filter(set => set.exerciseId === exerciseId && previousById.has(set.workoutId)).map(set => measured({ ...set, exerciseName: best.exerciseName, muscleGroup: best.muscleGroup,
      volume: setVolume(set.weightKg, set.reps, set.equipment ?? catalog.get(exerciseId)?.equipment, set.bodyWeightKg, isTimedExercise(best.exerciseName), set) }));
    const past = pastRows.filter(set => unit(set) === unit(best) && (!isTimedExercise(set.exerciseName) || (set.durationSeconds ?? 0) > 0));
    const previousId = [...new Set(past.map(set => set.workoutId))].sort((a, b) => Date.parse(previousById.get(b)!.startedAt) - Date.parse(previousById.get(a)!.startedAt) || b - a)[0];
    const prior = previousId == null ? null : bestOf(past.filter(set => set.workoutId === previousId));
    let status: RecapExercise["status"] = prior ? "repeat" : "first", change = prior ? "Результат сохранён" : "Первая сопоставимая запись";
    const timed = isTimedExercise(best.exerciseName), assisted = isAssisted(best), count = (row: MeasuredSet) => timed ? row.durationSeconds ?? 0 : row.weightKg;
    const differentUnits = allCurrent.length !== current.length || !prior && pastRows.some(set => unit(set) !== unit(best));
    if (prior && !assisted && count(best) > Math.max(...past.map(count))) {
      status = "record"; change = timed ? `Новое удержание · +${formatSeconds(count(best) - Math.max(...past.map(count)))}` : `Новый вес в журнале · +${formatKg(count(best) - Math.max(...past.map(count)))}`;
    } else if (prior && !timed && best.weightKg === prior.weightKg && best.reps > prior.reps) {
      const matching = past.filter(set => set.weightKg === best.weightKg && (!assisted || set.bodyWeightKg === best.bodyWeightKg));
      status = matching.length && best.reps > Math.max(...matching.map(set => set.reps)) ? "record" : "improved";
      change = `${status === "record" ? "Новые повторы в журнале · " : ""}${prior.reps} → ${best.reps} при том же ${assisted ? "противовесе" : "весе"}${best.rir == null || best.rir !== prior.rir || best.technique !== "good" || prior.technique !== "good" ? " · усилие не сопоставлено" : " · тот же запас"}`;
    } else if (prior && !timed && best.weightKg !== prior.weightKg) {
      status = "changed"; change = `${assisted ? "Противовес" : "Вес"}: ${formatKg(prior.weightKg)} → ${formatKg(best.weightKg)} · повторы ${prior.reps} → ${best.reps}`;
    } else if (prior && timed && count(best) !== count(prior)) { status = "changed"; change = "Время удержания изменилось"; }
    else if (prior && !timed && best.reps !== prior.reps) { status = "changed"; change = "Количество повторов изменилось"; }
    if (differentUnits) { status = "changed"; change = "Разные единицы или варианты нагрузки: без прямого сравнения. Все подходы сохранены."; }
    if (timed && !best.durationSeconds) { status = "changed"; change = "В старой записи не указано время удержания"; }
    if (allCurrent.some(set => set.technique === "breakdown")) { status = "attention"; change = "Отмечено нарушение техники"; }
    let next: RecapExercise["next"] = null;
    const exercise = catalog.get(exerciseId);
    if (exercise && !exercise.deletedAt && !exercise.replacementPending && !timed && !assisted && Date.parse(workout.finishedAt!) <= now) {
      const prediction = buildNextExercisePrediction(state, exerciseId, now);
      next = { result: `${exercise.equipment === "bodyweight" ? "+" : ""}${formatKg(prediction.next.weightKg)}${exercise.equipment === "dumbbell" ? " на гантель" : ""} × ${prediction.next.reps}`, reason: prediction.next.reason };
    }
    return { exerciseId, name: best.exerciseName, sets: allCurrent.length, best, previous: prior ? { date: previousById.get(prior.workoutId)!.startedAt, best: prior } : null, status, change, next };
  });
  const repSets = sets.filter(set => !isTimedExercise(set.exerciseName));
  const elapsed = (Date.parse(workout.finishedAt!) - Date.parse(workout.startedAt)) / 60000;
  const groups = new Map<string, number>();
  for (const set of sets) groups.set(set.muscleGroup, (groups.get(set.muscleGroup) ?? 0) + 1);
  return { workout, exercises, records: exercises.filter(ex => ex.status === "record").length, firstExercises: exercises.filter(ex => ex.status === "first").length,
    feedback: { repSets: repSets.length, rirKnown: repSets.filter(set => set.rir != null).length, breakdown: sets.filter(set => set.technique === "breakdown").length, failure: repSets.filter(set => set.rir === 0).length },
    groups: [...groups].map(([name, sets]) => ({ name, sets })), elapsedMinutes: Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : null, repetitions: repSets.reduce((sum, set) => sum + set.reps, 0) };
}
