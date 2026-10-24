import { defaultCoachProfile, goalPrescription, personalCoachProfile } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { buildAdaptiveSplit, planningGroup, type SplitDay } from "./adaptiveWorkout";
import { monthProgress } from "./coachMonth";
import { buildNextExercisePrediction } from "./trainingPrediction";
import { isAssisted } from "./equipmentSettings";
import { isTimedExercise, sameLoadCategory } from "./workoutMeasurement";
import { localDateKey } from "./trainingInsights";
import type { SetTarget } from "./workoutTemplates";
import { bodyWeightForecast } from "./bodyWeight";
import { progressionIncrement } from "./trainingCoach";

const daysBetween = (a: string, b: string) => (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
const phases = ["push", "pull", "legs"] as const;
const sessionLimit = 6;
const phaseFor = (group: string) => ["Грудь", "Плечи", "Трицепс"].includes(group) ? "push" : ["Спина", "Бицепс"].includes(group) ? "pull" : "legs";

function planningContext(state: OfflineState, now: Date) {
  const profile = personalCoachProfile(state.coachProfile ?? defaultCoachProfile()), today = localDateKey(now);
  const finished = state.workouts.filter(w => w.finishedAt && Date.parse(w.finishedAt) <= now.getTime() && Date.parse(w.startedAt) <= Date.parse(w.finishedAt));
  const doneIds = new Set(finished.map(w => w.id)), byWorkout = new Map(finished.map(w => [w.id, w]));
  const active = state.workouts.find(w => !w.finishedAt && w.trainingMode !== "office" && Date.parse(w.startedAt) <= now.getTime());
  const month = monthProgress(state), remaining = month?.slots.filter(slot => !slot.completed && !(active?.coachCycle?.planId === month.saved.id && active.coachCycle.slot === slot.slot)) ?? [];
  const monthly = remaining.length > 0;
  const spacing = 7 / (monthly ? month!.saved.plan.daysPerWeek : profile.daysPerWeek);
  const previousDates = finished.filter(w => w.trainingMode !== "office").map(w => localDateKey(new Date(w.startedAt))).sort();
  const latestDay = active ? localDateKey(new Date(active.startedAt)) : previousDates.at(-1);
  const firstOffset = latestDay ? Math.max(0, Math.round(spacing) - daysBetween(today, latestDay)) : 0;
  const firstDate = addDays(now, firstOffset);
  const available = state.exercises.filter(ex => !ex.deletedAt && !ex.replacementPending && profile.equipment.includes(ex.equipment) && !isAssisted(ex));
  const definitions = phases.flatMap(phase => buildAdaptiveSplit(state, profile, available, now.getTime(), phase).definitions);
  const timeline: Array<{ date: string; day: SplitDay }> = [];
  if (!monthly) {
    // Only the scenario copy records assumed successes; real observations stay untouched.
    const scenario = { ...state, workouts: state.workouts.filter(w => doneIds.has(w.id) || w === active).map(w => w === active ? { ...w, finishedAt: w.startedAt } : w), sets: state.sets.filter(s => doneIds.has(s.workoutId) || s.workoutId === active?.id) };
    for (let index = 0; index < 18; index++) {
      const date = addDays(firstDate, Math.round(index * spacing));
      const split = buildAdaptiveSplit(scenario, profile, available, date.getTime());
      timeline.push({ date: localDateKey(date), day: split.day });
      const id = scenario.nextWorkoutId++;
      scenario.workouts.push({ id, name: split.name, startedAt: date.toISOString(), finishedAt: date.toISOString(), splitDay: split.day });
      for (const def of split.definitions) for (let i = 0; i < def.sets; i++) scenario.sets.push({ id: scenario.nextSetId++, workoutId: id, exerciseId: def.exerciseId, weightKg: 0, reps: def.repsMin, rir: 2, technique: "good", createdAt: date.toISOString() });
    }
  }
  return { profile, doneIds, byWorkout, monthly, remaining, spacing, firstDate, definitions, timeline };
}

export function buildExerciseOutlook(state: OfflineState, exerciseId: number, now = new Date(), planning = planningContext(state, now)) {
  const exercise = state.exercises.find(row => row.id === exerciseId && !row.deletedAt && !row.replacementPending);
  if (!exercise) throw new Error("Упражнение недоступно.");
  const { profile, doneIds, byWorkout, monthly, remaining, spacing, firstDate, definitions, timeline } = planning;
  const policy = goalPrescription(profile.goal, exercise), timed = isTimedExercise(exercise.name), assisted = isAssisted(exercise);
  const history = state.sets.filter(row => doneIds.has(row.workoutId) && row.exerciseId === exerciseId && sameLoadCategory(row, exercise) && (exercise.equipment !== "dumbbell" || (row.dumbbellCount ?? 1) === (exercise.dumbbellCount ?? 1)))
    .sort((a, b) => byWorkout.get(a.workoutId)!.finishedAt!.localeCompare(byWorkout.get(b.workoutId)!.finishedAt!) || a.workoutId - b.workoutId || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const last = history.at(-1);
  const phase = phaseFor(planningGroup(exercise));
  const phaseDefinition = definitions.find(row => row.exerciseId === exerciseId);
  let scheduleSource = monthly ? "Месячный план" : phaseDefinition ? "Текущий состав сплита" : "Условное повторение упражнения";
  const occurrences: Array<{ date: string; sets: number; durationSeconds?: number }> = [];
  if (profile.equipment.includes(exercise.equipment) && !profile.excludedExerciseIds.includes(exerciseId) && (!assisted || state.profile.bodyWeightKg != null)) {
    if (monthly) remaining.forEach((slot, index) => {
      const row = slot.template.exercises.find(ex => ex.exerciseId === exerciseId);
      if (row && occurrences.length < sessionLimit) occurrences.push({ date: localDateKey(addDays(firstDate, Math.round(index * spacing))), sets: row.targets.length, durationSeconds: row.targets[0]?.durationSeconds ?? undefined });
    });
    else {
      for (const row of timeline.filter(row => row.day === phase).slice(0, sessionLimit)) occurrences.push({ date: row.date, sets: phaseDefinition?.sets ?? (policy.intent === "accessory" ? 2 : 3) });
    }
  }
  const count = occurrences[0]?.sets ?? phaseDefinition?.sets ?? 3;
  const prediction = buildNextExercisePrediction(state, exerciseId, now.getTime(), { ...policy, sets: count });
  const calibration = !timed && !assisted && (prediction.next.action === "calibrate" || !last);
  let targets: SetTarget[] = Array.from({ length: count }, (_, index) => timed
    ? { weightKg: 0, reps: 0, durationSeconds: last?.durationSeconds ?? occurrences[0]?.durationSeconds ?? 30 }
    : assisted ? { weightKg: Math.min(last?.weightKg ?? 20, state.profile.bodyWeightKg ?? 20), reps: Math.min(last?.reps ?? 6, policy.repsMax) }
    : { weightKg: (prediction.model.targets[index] ?? prediction.next).weightKg, reps: calibration && exercise.equipment === "bodyweight" && !last ? 3 : (prediction.model.targets[index] ?? prediction.next).reps });
  // Future successes are explicit scenario assumptions, never observations for EMA.
  const latestSession = history.filter(row => row.workoutId === last?.workoutId);
  const actualDate = last ? localDateKey(new Date(byWorkout.get(last.workoutId)!.finishedAt!)) : null;
  const recent = actualDate && occurrences[0] && daysBetween(occurrences[0].date, actualDate) <= 28;
  let successes = recent && latestSession.length === count && latestSession.every(row => row.weightKg === targets[0].weightKg && row.reps >= policy.repsMax && row.technique === "good" && (row.rir ?? 0) >= 2) ? 1 : 0;
  let previousCount = count;
  const sessions = occurrences.map((occurrence, index) => {
    if (index > 0 && !calibration && !timed && !assisted) {
      const atTop = targets.every(set => set.reps >= policy.repsMax);
      successes = previousCount === occurrence.sets && atTop && daysBetween(occurrence.date, occurrences[index - 1].date) <= 28 ? successes + 1 : 0;
      const increment = progressionIncrement(targets[0].weightKg, exercise.weightStepKg ?? 2.5, false, exercise.equipment);
      const increase = successes >= 2 && increment != null && exercise.equipment !== "bodyweight";
      targets = targets.map(set => ({ weightKg: Math.round((set.weightKg + (increase ? increment! : 0)) * 100) / 100,
        reps: increase ? policy.repsMin : Math.min(policy.repsMax, set.reps + (atTop ? 0 : 1)) }));
      if (increase) successes = 0;
    }
    previousCount = occurrence.sets;
    const sets = calibration ? 1 : occurrence.sets;
    return { date: occurrence.date, conditional: index > 0, calibration, targets: Array.from({ length: sets }, (_, i) => ({ ...(targets[i] ?? targets.at(-1)!) })) };
  });
  if (!occurrences.length) scheduleSource = assisted && state.profile.bodyWeightKg == null ? "Для подбора противовеса сначала укажите массу тела" : monthly ? "В оставшихся занятиях месяца этого упражнения нет" : !profile.equipment.includes(exercise.equipment) || profile.excludedExerciseIds.includes(exerciseId) ? "Упражнение исключено из плана" : "В ближайшем рекомендованном сценарии этого упражнения нет";
  const initialWeightKg = sessions[0]?.targets[0]?.weightKg ?? null;
  const lastWeightKg = sessions.at(-1)?.targets[0]?.weightKg ?? null;
  const stepKg = exercise.weightStepKg ?? 2.5;
  const firstIncrease = initialWeightKg == null ? undefined : sessions.find(row => row.targets[0].weightKg > initialWeightKg);
  const progression = !calibration && !timed && !assisted && exercise.equipment !== "bodyweight" && initialWeightKg != null && progressionIncrement(initialWeightKg, stepKg, false, exercise.equipment) != null
    ? { nextWeightKg: Math.round((initialWeightKg + stepKg) * 100) / 100, earliestDate: firstIncrease?.date ?? null,
      reps: policy.repsMax, sets: count, confirmations: 2, targetRir: 2 }
    : null;
  return { exercise: { id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, isMain: exercise.isMain, isCustom: exercise.isCustom },
    repsMin: policy.repsMin, repsMax: policy.repsMax, targetRir: 2, weightStepKg: stepKg, timed, assisted, calibration, scheduleSource, sessions, progression,
    initialWeightKg, changeKg: !calibration && !timed && !assisted && initialWeightKg != null && lastWeightKg != null ? Math.round((lastWeightKg - initialWeightKg) * 100) / 100 : null,
    reason: timed && !last ? "Время пока не проверено по вашим подходам; начальный ориентир требует посильной проверки без боли." : assisted ? "Противовес подбирается вручную. Уменьшение противовеса повышает, а не снижает нагрузку." : prediction.next.reason,
    assumptions: `Даты предполагаемые: ${monthly ? "месячный план" : "настройки"}, ${monthly ? Math.round(7 / spacing) : profile.daysPerWeek} занятий в неделю; дни недели не закреплены. Следующие назначения — сценарий при выполнении всех подходов с целевым запасом и техникой, не обещание прогресса. Пропуск, изменение плана или новая запись пересчитывают прогноз.`,
  };
}
export type ExerciseOutlook = ReturnType<typeof buildExerciseOutlook>;

export function buildProgressOutlook(state: OfflineState, now = new Date()) {
  const planning = planningContext(state, now);
  return { body: { ...bodyWeightForecast(state.bodyWeightLog, now), currentKg: state.profile.bodyWeightKg },
    exercises: state.exercises.filter(ex => !ex.deletedAt && !ex.replacementPending).map(ex => buildExerciseOutlook(state, ex.id, now, planning)) };
}
