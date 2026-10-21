import { trainingAnalysisSchema, calibrationWeight, type TrainingAnalysis } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { isTimedExercise, minimumWeight, sameLoadCategory } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";
import { nextWorkingLoad } from "./trainingCoach";
import { forecastWorkingSets } from "./trainingPrediction";

export function formatAnalysisResult(row: TrainingAnalysis["exercises"][number], target: boolean): string {
  const value = target ? row.next : row.best;
  if (row.next.seconds > 0) return value.seconds > 0 ? `${value.seconds} с` : "Время не записано";
  const prefix = row.assisted ? "Противовес " : row.equipment === "bodyweight" ? "+" : row.equipment === "dumbbell" && row.dumbbellCount === 2 ? "2 × " : "";
  return `${prefix}${value.weightKg.toLocaleString("ru-RU")} кг × ${value.reps}`;
}

type Row = OfflineState["sets"][number] & { name: string; group: string; equipment: OfflineState["exercises"][number]["equipment"]; date: string; workoutFinishedAt: string; key: string };
const totals = (rows: Row[], workouts: number): TrainingAnalysis["totals"] => {
  const reps = rows.filter(row => row.durationSeconds == null && !isTimedExercise(row.name));
  const rirBuckets = Array<number>(7).fill(0);
  for (const row of reps) rirBuckets[row.rir ?? 6]++;
  return { workouts, sets: rows.length, reps: reps.reduce((n, row) => n + row.reps, 0), seconds: rows.reduce((n, row) => n + (row.durationSeconds ?? 0), 0),
    repSets: reps.length, rirKnown: reps.filter(row => row.rir != null).length, techniqueKnown: rows.filter(row => row.technique != null).length,
    failureSets: reps.filter(row => row.rir === 0).length, breakdownSets: rows.filter(row => row.technique === "breakdown").length, rirBuckets };
};

export function buildTrainingAnalysis(state: OfflineState, workoutId?: number, now = new Date()): TrainingAnalysis {
  const focus = workoutId == null ? undefined : state.workouts.find(row => row.id === workoutId && row.finishedAt);
  if (workoutId != null && !focus) throw new Error("Сначала завершите тренировку.");
  if (focus && Date.parse(focus.finishedAt!) > now.getTime()) throw new Error("Дата завершения находится в будущем. Проверьте часы устройства; записи не изменены.");
  const cutoff = focus ? Math.min(Date.parse(focus.finishedAt!), now.getTime()) : now.getTime();
  // A stable calendar anchor keeps context hashes identical during one request.
  const calendarDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const anchor = calendarDate(new Date(cutoff));
  const end = new Date(cutoff);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 27).getTime();
  const start7 = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6).getTime();
  const workouts = state.workouts.filter(row => row.finishedAt && Number.isFinite(Date.parse(row.startedAt)) && Date.parse(row.startedAt) <= Date.parse(row.finishedAt) && Date.parse(row.finishedAt) <= cutoff);
  const byWorkout = new Map(workouts.map(row => [row.id, row]));
  const byExercise = new Map(state.exercises.map(row => [row.id, row]));
  const rows: Row[] = [];
  for (const set of state.sets) {
    const workout = byWorkout.get(set.workoutId), exercise = byExercise.get(set.exerciseId);
    if (!workout || !exercise) continue;
    const equipment = set.equipment ?? exercise.equipment;
    const key = `${exercise.id}/${equipment}/${isAssisted(set) ? "assisted" : "weight"}/${equipment === "dumbbell" ? set.dumbbellCount ?? 1 : 1}`;
    rows.push({ ...set, equipment, name: exercise.name, group: exercise.muscleGroup, date: workout.startedAt, workoutFinishedAt: workout.finishedAt!, key });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.workoutId - b.workoutId || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  const period = rows.filter(row => Date.parse(row.date) >= start);
  const focusRows = focus ? rows.filter(row => row.workoutId === focus.id) : null;
  const groups = new Map<string, Row[]>();
  for (const row of period) { const batch = groups.get(row.group) ?? []; batch.push(row); groups.set(row.group, batch); }
  const byKey = new Map<string, Row[]>();
  for (const row of rows) { const batch = byKey.get(row.key) ?? []; batch.push(row); byKey.set(row.key, batch); }
  const keys = [...new Set((focusRows ?? period).slice().reverse().map(row => row.key))];
  const exercises: TrainingAnalysis["exercises"] = keys.slice(0, 16).map(key => {
    const all = byKey.get(key)!;
    const last = (focusRows?.find(row => row.key === key) ?? all.at(-1))!;
    const session = all.filter(row => row.workoutId === last.workoutId);
    const previousId = all.filter(row => Date.parse(row.date) < Date.parse(last.date) || row.date === last.date && row.workoutId < last.workoutId).at(-1)?.workoutId;
    const previous = all.filter(row => row.workoutId === previousId);
    const best = session.reduce((best, row) => (row.durationSeconds ?? 0) > (best.durationSeconds ?? 0) || row.durationSeconds == null && (isAssisted(row) ? row.weightKg < best.weightKg : row.weightKg > best.weightKg) || row.weightKg === best.weightKg && row.reps > best.reps ? row : best, session[0]);
    const comparable = previous.filter(row => row.weightKg === best.weightKg && row.durationSeconds == null);
    const effortMatches = (row: Row) => row.rir != null && row.rir === best.rir && row.technique === "good" && best.technique === "good";
    const prior = comparable.sort((a, b) => Number(effortMatches(b)) - Number(effortMatches(a)) || b.reps - a.reps)[0];
    const exercise = byExercise.get(last.exerciseId)!;
    const definition = state.customPrograms.flatMap(plan => plan.exercises).find(row => row.exerciseId === last.exerciseId);
    const range = { exerciseId: last.exerciseId, equipment: last.equipment, sets: definition?.sets ?? 3, repsMin: definition?.repsMin ?? (state.coachProfile?.goal === "strength" ? 3 : 8), repsMax: definition?.repsMax ?? (state.coachProfile?.goal === "strength" ? 6 : 12), targetRir: definition?.targetRir ?? 2, weightStepKg: exercise.weightStepKg ?? definition?.weightStepKg ?? 2.5 };
    const timed = isTimedExercise(last.name);
    const inRange = (row: Row) => row.reps >= range.repsMin && row.reps <= 30;
    const rangeSet = session.filter(inRange).at(-1) ?? all.filter(row => Date.parse(row.date) >= start && inRange(row)).at(-1);
    const result = nextWorkingLoad(all, range, cutoff);
    const breakdown = session.some(row => row.technique === "breakdown");
    const missing = session.some(row => row.rir == null || row.technique == null);
    const failure = session.some(row => row.rir === 0);
    const canTransfer = sameLoadCategory(last, exercise) && (last.dumbbellCount ?? 1) === (exercise.dumbbellCount ?? 1);
    let next: TrainingAnalysis["exercises"][number]["next"] = { weightKg: best.weightKg, reps: best.reps, seconds: best.durationSeconds ?? 0, action: "hold", reason: "Повторите нагрузку и оцените запас и технику; восстановление по журналу неизвестно." };
    if (timed) next = { weightKg: 0, reps: 0, seconds: Math.max(1, best.durationSeconds ?? 30), action: best.durationSeconds ? "hold" : "calibrate", reason: best.durationSeconds ? "Удержание в секундах. Повторите измеренное время без автоматической прибавки." : "В старой записи нет времени. 30 с — начальный ориентир, не подтверждённый результат; измерьте посильное удержание." };
    else if (isAssisted(last)) next.reason = "Это противовес, а не отягощение. Подбор помощи пока вручную; не повышайте нагрузку при ухудшении техники.";
    else if (!canTransfer || !rangeSet && last.equipment !== "bodyweight") next = { weightKg: calibrationWeight(exercise.equipment), reps: exercise.equipment === "bodyweight" ? 3 : 8, seconds: 0, action: "calibrate", reason: "Нет сопоставимого подхода в целевом диапазоне. Начните с калибровки, не переносите одиночный максимум в рабочие веса." };
    else {
      const baseline = rangeSet ?? session.at(-1)!;
      next = { weightKg: baseline.weightKg, reps: Math.min(baseline.reps, range.repsMax), seconds: 0, action: "hold", reason: missing ? "Не хватает RIR или оценки техники. Повторите вес и отметьте усилие." : failure ? "Есть подход до отказа. Не повышайте нагрузку, сначала восстановите запас повторений." : result.reason };
      if (breakdown) next = { ...next, weightKg: Math.max(minimumWeight(last.equipment), baseline.weightKg - range.weightStepKg), reps: Math.max(1, Math.min(baseline.reps - 1, range.repsMin)), action: "reduce", reason: "Отмечено нарушение техники. Уменьшите нагрузку; если техника не сохраняется или есть боль, остановите упражнение." };
      else if (!missing && !failure && result.increase && baseline.weightKg === all.at(-1)!.weightKg) next = { ...next, weightKg: result.weightKg!, reps: range.repsMin, action: "increase", reason: result.reason };
      else if (!missing && !failure && session.every(row => row.technique === "good" && (row.rir ?? 0) >= range.targetRir) && baseline.reps < range.repsMax) next = { ...next, reps: baseline.reps + 1, action: "progress_reps", reason: "Сначала добавьте одно повторение при том же весе, сохраняя целевой запас и технику." };
    }
    const forecast = forecastWorkingSets(all.map(row => ({ ...row, workoutStartedAt: row.date })), range, next,
      { equipment: last.equipment, timed, assisted: isAssisted(last) }, cutoff);
    if (!timed && !isAssisted(last) && canTransfer) next = { ...next, ...forecast.next };
    return { key, exerciseId: last.exerciseId, name: last.name, equipment: last.equipment, assisted: isAssisted(last), dumbbellCount: last.dumbbellCount ?? 1, matchesCurrentCategory: canTransfer, model: forecast.model,
      range: { sets: range.sets, repsMin: range.repsMin, repsMax: range.repsMax, source: definition ? "template" : "goal-default" },
      workoutId: last.workoutId, date: last.date, sets: session.length, best: { weightKg: best.weightKg, reps: timed ? 0 : best.reps, seconds: best.durationSeconds ?? 0 },
      comparison: !timed && prior ? { workoutId: prior.workoutId, weightKg: best.weightKg, previousReps: prior.reps, currentReps: best.reps, comparableEffort: prior.rir != null && best.rir === prior.rir && prior.technique === "good" && best.technique === "good" } : null, next };
  });
  const limitations = ["Тоннаж и число записей не измеряют рост мышц. Все подходы учтены без деления на разминку и рабочие.", "Время внесения подходов не показывает фактический отдых или длительность тренировки.", "Данных о сне, самочувствии и боли нет: восстановление не оценено.", "RIR и техника — самооценки; значения могли переноситься из предыдущего подхода.", "Мышцы учтены по основной группе каталога, без оценки косвенной нагрузки. Сравнение предполагает один вариант движения и одинаковое оборудование."];
  if (period.some(row => row.rir == null && !isTimedExercise(row.name))) limitations.push("У части подходов нет RIR: нельзя надёжно сравнить усилие.");
  if (period.some(row => row.equipment === "bodyweight" && row.bodyWeightKg == null)) limitations.push("У части упражнений с собственным весом нет сохранённой массы тела.");
  if (keys.length > 16 || groups.size > 40) limitations.push("Показана часть упражнений или групп; общие количества включают все записи периода.");
  if (workouts.length < 6) limitations.push("История короткая: одного результата недостаточно для вывода о прогрессе или плато.");
  return trainingAnalysisSchema.parse({ version: 1, asOf: anchor, from: calendarDate(new Date(start)), totals: totals(period, workouts.filter(row => Date.parse(row.startedAt) >= start).length),
    focus: focus ? { workoutId: focus.id, totals: totals(focusRows!, 1) } : null,
    groups: [...groups].map(([name, batch]) => { const recent = batch.filter(row => Date.parse(row.date) >= start7); const days = (rows: Row[]) => new Set(rows.map(row => new Date(row.date).toLocaleDateString("en-CA"))).size; return { name, sets7: recent.length, days7: days(recent), sets28: batch.length, days28: days(batch) }; }).sort((a, b) => b.sets28 - a.sets28 || a.name.localeCompare(b.name, "ru")).slice(0, 40),
    exercises, omittedExercises: Math.max(0, keys.length - exercises.length), limitations });
}
