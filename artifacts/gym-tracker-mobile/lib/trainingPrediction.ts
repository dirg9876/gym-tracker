import { controlPrediction, estimateStrength, modelForecastSchema, predictReps, predictWeight, roundWeightDown, qualityEstimate, type LoadGuard, type StrengthObservation } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { sameLoadCategory, isTimedExercise, minimumWeight } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";
import { nextWorkingLoad } from "./trainingCoach";
import { relatedCalibration } from "./relatedLoads";

type Range = { sets: number; repsMin: number; repsMax: number; targetRir: number; weightStepKg: number };
type CurrentSet = Pick<StrengthObservation, "weightKg" | "reps" | "rir" | "technique" | "durationSeconds">;
export function forecastWorkingSets(history: StrengthObservation[], range: Range, guard: LoadGuard,
  equipment: { equipment: string; timed?: boolean; assisted?: boolean }, now: number, current: CurrentSet[] = []) {
  const supported = ["barbell", "dumbbell", "machine"].includes(equipment.equipment) && !equipment.timed && !equipment.assisted;
  const minimumKg = equipment.equipment === "barbell" ? 20 : 0;
  const fitted = estimateStrength(supported ? history.filter(row => row.weightKg >= minimumKg) : [], now);
  const firstToday = current.find(row => row.weightKg >= minimumKg && qualityEstimate(row) != null);
  const todayStrength = firstToday ? qualityEstimate(firstToday) : null;
  const strength = supported ? todayStrength ?? (!fitted.stale ? fitted.estimated1RMKg : null) : null;
  const last = current.at(-1) ?? history.at(-1);
  const hasFeedback = last?.rir != null && last.technique != null;
  const latestSession = history.filter(row => row.workoutId === history.at(-1)?.workoutId);
  const latestMeasured = current.length ? firstToday != null : latestSession.some(row => row.weightKg >= minimumKg && qualityEstimate(row) != null);
  const status = !supported ? "unsupported" : strength != null && latestMeasured ? "ready" : fitted.stale && fitted.estimated1RMKg != null ? "stale" : "insufficient";
  const targets: Array<{ weightKg: number; reps: number }> = [];
  let first = { ...guard, predictedReps: null as number | null, unroundedWeightKg: null as number | null };
  for (let i = 0; i < 6; i++) {
    const fatigueReps = (fitted.fatigueBeta ?? 0) * (current.length - (firstToday ? current.indexOf(firstToday) : 0) + i);
    const result = controlPrediction({ strengthKg: supported && hasFeedback && latestMeasured ? strength : null, guard,
      repsMin: range.repsMin, targetRir: range.targetRir, stepKg: range.weightStepKg,
      minimumKg: minimumWeight(equipment.equipment as "barbell"), fatigueReps });
    targets.push({ weightKg: result.weightKg, reps: result.reps });
    if (i === 0) first = result;
  }
  const note = !supported ? "Формула не применяется к секундам, собственному весу, противовесу и категории «Другое». Здесь действуют обычные правила и калибровка." : status === "stale" ? "Нет качественного измерения за 28 дней. Нужна повторная оценка; старый расчёт не повышает нагрузку." : status === "insufficient" ? "В последнем занятии нет подхода для формулы: нужны 2–10 повторений, RIR 0–3 и сохранённая техника. Цель задана правилами прогрессии или калибровки, а не старым прогнозом." : "Приближённая оценка Эпли + RIR, EMA 0,2 по одному подходу на занятие. Не рекорд и не норматив. Прогноз не определяет восстановление; RIR и техника субъективны.";
  return { next: { weightKg: first.weightKg, reps: first.reps, action: first.action, reason: first.reason },
    model: modelForecastSchema.parse({ version: "epley-rir-ema-v1", status,
      estimated1RMKg: supported ? strength ?? fitted.estimated1RMKg : null, sessions: fitted.sessions,
      targetRir: range.targetRir, source: strength == null ? null : todayStrength != null ? "today" : "history",
      validationSamples: fitted.validationSamples, repErrorMAE: fitted.repErrorMAE, rirErrorMAE: null,
      fatigueBeta: fitted.fatigueBeta, fatigueSamples: fitted.fatigueSamples,
      unroundedWeightKg: first.unroundedWeightKg, predictedReps: first.predictedReps, targets: supported ? targets : [], note }) };
}

export function buildActivePrediction(state: OfflineState, workoutId: number, exerciseId: number, now = Date.now(), planned?: { sets: number; repsMin: number; repsMax: number; targetRir?: number; weightStepKg?: number }) {
  const workout = state.workouts.find(row => row.id === workoutId && !row.finishedAt);
  const exercise = state.exercises.find(row => row.id === exerciseId && !row.deletedAt);
  if (!workout || !exercise) throw new Error("Тренировка или упражнение недоступны.");
  const definition = planned ?? state.customPrograms.flatMap(plan => plan.exercises).find(row => row.exerciseId === exerciseId);
  const range = { sets: definition?.sets ?? 3, repsMin: definition?.repsMin ?? (state.coachProfile?.goal === "strength" ? 3 : 8),
    repsMax: definition?.repsMax ?? (state.coachProfile?.goal === "strength" ? 6 : 12), targetRir: definition?.targetRir ?? 2, weightStepKg: exercise.weightStepKg ?? definition?.weightStepKg ?? 2.5 };
  const compatible = state.sets.filter(row => row.exerciseId === exerciseId && sameLoadCategory(row, exercise) && (exercise.equipment !== "dumbbell" || (row.dumbbellCount ?? 1) === (exercise.dumbbellCount ?? 1)));
  const before = Math.min(now, Date.parse(workout.startedAt));
  const finished = new Map(state.workouts.filter(row => row.finishedAt && Date.parse(row.finishedAt) <= before).map(row => [row.id, row]));
  const history = compatible.filter(row => finished.has(row.workoutId)).map(row => ({ ...row, workoutStartedAt: finished.get(row.workoutId)!.startedAt, workoutFinishedAt: finished.get(row.workoutId)!.finishedAt! })).sort((a, b) => a.workoutFinishedAt.localeCompare(b.workoutFinishedAt) || a.workoutId - b.workoutId || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const current = compatible.filter(row => row.workoutId === workoutId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const last = current.at(-1) ?? history.at(-1);
  const working = [...history, ...current].filter(row => row.reps >= range.repsMin && row.reps <= 30 && row.durationSeconds == null).at(-1);
  const baseline = working ?? last;
  const progression = nextWorkingLoad(history, { ...range, equipment: exercise.equipment, exerciseId }, now);
  let guard: LoadGuard = { weightKg: baseline?.weightKg ?? (exercise.equipment === "barbell" ? 20 : exercise.equipment === "bodyweight" ? 0 : exercise.equipment === "machine" ? 5 : 2.5), reps: Math.min(baseline?.reps ?? 8, range.repsMax), action: last ? "hold" : "calibrate", reason: "Повторите нагрузку, сохраняя целевой запас. Оцените фактическую технику и усилие." };
  if (!current.length && progression.increase) guard = { weightKg: progression.weightKg!, reps: range.repsMin, action: "increase", reason: progression.reason };
  if (current.length === 1 && !history.length && last?.technique === "good" && last.rir != null && last.rir >= 4 && range.weightStepKg <= 2.5 && exercise.equipment !== "bodyweight") guard = { ...guard, weightKg: last.weightKg + range.weightStepKg, action: "increase", reason: "После первого лёгкого подборочного подхода разрешён один шаг оборудования. Оцените запас и технику снова." };
  const lastSession = history.filter(row => row.workoutId === last?.workoutId);
  if (!current.length && !progression.increase && last && last.reps >= range.repsMin && last.reps < range.repsMax && lastSession.every(row => row.technique === "good" && row.rir != null && row.rir >= Math.max(2, range.targetRir))) guard = { ...guard, reps: last.reps + 1, action: "progress_reps", reason: "Сначала добавьте повторение в диапазоне, сохраняя запас и технику. Формула проверит расчётный запас." };
  if (last && exercise.equipment !== "bodyweight" && !isTimedExercise(exercise.name) && !isAssisted(exercise) && !history.some(row => row.reps >= range.repsMin) && !current.some(row => row.reps >= range.repsMin)) guard = { weightKg: exercise.equipment === "barbell" ? 20 : exercise.equipment === "machine" ? 5 : 2.5, reps: 8, action: "calibrate", reason: "Нет рабочих подходов в целевом диапазоне. Сначала выполните подборочный подход с оценкой запаса и техники." };
  if (last?.technique === "breakdown") guard = { ...guard, weightKg: Math.max(minimumWeight(exercise.equipment), last.weightKg - range.weightStepKg), reps: Math.max(1, Math.min(last.reps - 1, range.repsMin)), action: "reduce", reason: "Техника нарушалась: снизьте нагрузку. При боли остановите упражнение." };
  if (current.length && last?.technique === "good" && last.rir != null && last.rir < range.targetRir && exercise.equipment !== "bodyweight" && !isAssisted(exercise) && !isTimedExercise(exercise.name)) {
    guard = { ...guard, weightKg: Math.max(minimumWeight(exercise.equipment), Math.min(guard.weightKg, last.weightKg - range.weightStepKg)),
      reps: range.repsMin, action: "reduce", reason: "Последний подход тяжелее целевого RIR; последующие подходы облегчены." };
  }
  const forecast = forecastWorkingSets(history, { ...range, sets: Math.max(1, range.sets - current.length) }, guard,
    { equipment: exercise.equipment, timed: isTimedExercise(exercise.name), assisted: isAssisted(exercise) }, now, current);
  let calibrationBasis: ReturnType<typeof relatedCalibration> = null;
  if (!current.length && forecast.next.action === "calibrate") {
    const measured = history.filter(row => row.weightKg >= minimumWeight(exercise.equipment) && qualityEstimate(row) != null).at(-1);
    if (measured && forecast.model.status === "ready" && forecast.model.estimated1RMKg != null) {
      const strength = forecast.model.estimated1RMKg;
      const targetReps = Math.min(8, range.repsMin);
      const weightKg = Math.max(forecast.next.weightKg, roundWeightDown(Math.min(measured.weightKg, predictWeight(strength, targetReps, range.targetRir)!), range.weightStepKg, minimumWeight(exercise.equipment))!);
      calibrationBasis = { exerciseId, sourceExerciseId: exerciseId, coefficient: 1, weightKg,
        reps: Math.max(1, Math.min(targetReps, Math.floor(predictReps(strength, weightKg, range.targetRir)! + 1e-8))),
        reason: "Подбор по вашим собственным подходам и оценке Эпли + RIR, а не по универсальному начальному весу. Первый подход проверочный: оцените запас и технику." };
    } else if (!history.some(row => row.reps >= range.repsMin && row.reps <= 30 && row.weightKg >= minimumWeight(exercise.equipment))) {
      calibrationBasis = relatedCalibration(state, exerciseId, before, Math.min(8, range.repsMin), range.weightStepKg);
    }
  }
  if (calibrationBasis && (calibrationBasis.weightKg > forecast.next.weightKg || calibrationBasis.weightKg === forecast.next.weightKg && calibrationBasis.reps < forecast.next.reps)) {
    forecast.next = { weightKg: calibrationBasis.weightKg, reps: calibrationBasis.reps, action: "calibrate", reason: calibrationBasis.reason };
    forecast.model = { ...forecast.model, note: calibrationBasis.reason, targets: Array.from({ length: 6 }, () => ({ weightKg: calibrationBasis.weightKg, reps: calibrationBasis.reps })) };
  }
  return { exerciseId, ...forecast, calibrationBasis: calibrationBasis && calibrationBasis.weightKg === forecast.next.weightKg ? calibrationBasis : null };
}

export function buildNextExercisePrediction(state: OfflineState, exerciseId: number, now: number, planned?: Parameters<typeof buildActivePrediction>[4]) {
  // A read-only prospective session reuses the same numerical policy as live sets.
  const prospective = { id: state.nextWorkoutId, name: null, startedAt: new Date(now).toISOString(), finishedAt: null };
  return buildActivePrediction({ ...state, workouts: [...state.workouts, prospective] }, prospective.id, exerciseId, now, planned);
}
