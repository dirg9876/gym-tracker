import { defaultCoachProfile, goalPrescription, personalCoachProfile, type CoachContext } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { nextScheduledSession } from "./coachMonth";
import { buildNextExercisePrediction, explainLoadCalculation } from "./trainingPrediction";
import { isTimedExercise, sameLoadCategory } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";
import { buildAdaptiveSplit, lastWorkoutSplit, SPLIT_DAYS, type SplitDay } from "./adaptiveWorkout";
import type { TemplatePlan, TemplateExercise, SetTarget } from "./workoutTemplates";

export type DailyWorkout = {
  date: string; source: "month" | "template" | "balanced"; reason: string;
  plan: TemplatePlan | null; scheduled: CoachContext["scheduled"] | null; coachSupported: boolean;
  splitDay?: SplitDay;
};
export type DailyPreview = DailyWorkout & { choices: DailyWorkout[]; fingerprint: string; activeWorkoutId: number | null };
type Definition = { exerciseId: number; sets: number; repsMin: number; repsMax: number; durationSeconds?: number; targetRir?: number; intent?: TemplateExercise["intent"]; note?: string | null };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function buildDailyWorkout(state: OfflineState, now = new Date(), preferredDay?: SplitDay): DailyWorkout {
  const date = dateKey(now), timestamp = now.getTime();
  const profile = personalCoachProfile(state.coachProfile ?? defaultCoachProfile());
  const available = state.exercises.filter(ex => !ex.deletedAt && !ex.replacementPending && profile.equipment.includes(ex.equipment) && (!isAssisted(ex) || state.profile.bodyWeightKg != null));
  const byId = new Map(available.map(ex => [ex.id, ex]));
  const finished = state.workouts.filter(w => w.finishedAt && Date.parse(w.finishedAt) <= timestamp).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!) || a.id - b.id);
  const finishedIds = new Set(finished.map(w => w.id));
  const history = state.sets.filter(s => finishedIds.has(s.workoutId));
  let source: DailyWorkout["source"] = "balanced", name = "Тренировка на сегодня";
  let reason = history.length ? "План сформирован по всей истории завершённых тренировок: знакомые основные движения, учёт недавней нагрузки и щадящая прогрессия. Журнал не определяет восстановление точно." : "Начальный план основных движений. Для незнакомых упражнений вес уточняется по первому подборочному подходу, без проверки максимума.";
  let definitions: Definition[] = [];
  let scheduled = nextScheduledSession(state) ?? null;
  const phaseOf = (group: string): SplitDay => ["Грудь", "Плечи", "Трицепс"].includes(group) ? "push" : ["Спина", "Бицепс"].includes(group) ? "pull" : "legs";
  const scheduledDay = scheduled ? SPLIT_DAYS.map(day => ({ day, count: scheduled!.plan.exercises.filter(ex => {
    const exercise = byId.get(ex.exerciseId); return exercise && phaseOf(exercise.muscleGroup) === day;
  }).reduce((sum, ex) => sum + ex.targets.length, 0) })).sort((a, b) => b.count - a.count)[0].day : undefined;
  if (preferredDay && preferredDay !== scheduledDay) scheduled = null;
  let splitDay = scheduled ? scheduledDay : undefined;
  if (scheduled) {
    definitions = scheduled.plan.exercises.filter(ex => byId.has(ex.exerciseId)).map(ex => {
      const values = ex.targets.map(set => set.durationSeconds ?? set.reps);
      // A saved AI month plan contains *suggested sets*, not authoritative rep ranges.
      // A heavy single (e.g. 85 kg x 1) must never turn into a hypertrophy prescription.
      const timed = isTimedExercise(byId.get(ex.exerciseId)!.name);
      const policy = goalPrescription(profile.goal, byId.get(ex.exerciseId)!);
      return { exerciseId: ex.exerciseId, sets: ex.targets.length,
        repsMin: timed ? Math.min(...values) : policy.repsMin,
        repsMax: timed ? Math.max(...values) : policy.repsMax,
        intent: policy.intent, targetRir: policy.targetRir,
        durationSeconds: ex.targets[0]?.durationSeconds ?? undefined, note: ex.reason };
    });
    if (definitions.length) { source = "month"; name = scheduled.plan.name; reason = `Следующее незавершённое занятие месячного плана · неделя ${scheduled.week}. Пропущенные занятия не списываются; нагрузки обновлены по истории.`; }
    else scheduled = null;
  }
  if (!definitions.length) {
    // Without a saved month, plan a genuinely new workout from the whole
    // completed history; custom templates remain available for manual use.
    source = "balanced";
    const split = buildAdaptiveSplit(state, profile, available, timestamp, preferredDay);
    splitDay = split.day;
    name = split.name;
    reason = split.reason;
    definitions = split.definitions;
  }
  const exercises: TemplateExercise[] = [];
  let remainingSets = Math.floor(profile.sessionMinutes / 2);
  for (const definition of definitions.slice(0, 8)) {
    const exercise = byId.get(definition.exerciseId)!;
    const compatible = history.filter(s => s.exerciseId === exercise.id && sameLoadCategory(s, exercise) && (exercise.equipment !== "dumbbell" || (s.dumbbellCount ?? 1) === (exercise.dumbbellCount ?? 1)));
    const count = Math.min(6, definition.sets, remainingSets);
    if (count < 1) break;
    const timed = isTimedExercise(exercise.name);
    const prediction = buildNextExercisePrediction(state, exercise.id, timestamp, definition);
    const basis = timed ? "" : `${goalPrescription(profile.goal, exercise).basis} ${explainLoadCalculation(prediction, exercise.weightStepKg ?? 2.5)} `;
    const last = compatible.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id).at(-1);
    const calibration = !timed && !isAssisted(exercise) && (prediction.next.action === "calibrate" || !compatible.length);
    const targets: SetTarget[] = Array.from({ length: count }, (_, i) => {
      if (timed) return { weightKg: 0, reps: 0, durationSeconds: last?.durationSeconds ?? definition.durationSeconds ?? 30, setType: "working" };
      if (isAssisted(exercise)) return { weightKg: Math.min(last?.weightKg ?? 20, state.profile.bodyWeightKg!), reps: Math.min(last?.reps ?? 6, definition.repsMax), setType: "working" };
      const result = prediction.model.targets[i] ?? prediction.next;
      return { weightKg: result.weightKg, reps: exercise.equipment === "bodyweight" && calibration ? 3 : result.reps, setType: "working" };
    });
    const values = targets.map(s => s.durationSeconds ?? s.reps);
    // Only the automatic split defers unknown working sets. A saved monthly
    // plan preserves its complete author-specified structure.
    const oneSetProbe = source === "balanced" && calibration && count > 1;
    exercises.push({ exerciseId: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, isBodyweight: exercise.equipment === "bodyweight", basedOn: "personal-record", suggestedWeightKg: targets[0].weightKg,
      sets: oneSetProbe ? 1 : count,
      repsMin: timed ? Math.min(...values) : definition.repsMin, repsMax: timed ? Math.max(...values) : definition.repsMax,
      intent: definition.intent ?? (profile.goal === "strength" ? "strength" : "hypertrophy"), weightStepKg: exercise.weightStepKg ?? 2.5, targetRir: definition.targetRir ?? 2,
      calibration,
      ...(oneSetProbe ? { postCalibrationSets: count - 1 } : {}),
      note: basis + (oneSetProbe ? `Сначала один подборочный подход. После записи RIR и техники будут рассчитаны ещё ${count - 1} рабочих подхода. ${prediction.next.reason}` :
        timed ? "Удержание в секундах, без веса." : isAssisted(exercise) ? "Противовес подбирается вручную, без автоматического повышения." : prediction.next.reason),
      setTargets: oneSetProbe ? targets.slice(0, 1) : targets });
    remainingSets -= count;
  }
  if (finished.some(w => dateKey(new Date(w.startedAt)) === date)) reason += " Сегодня уже записана тренировка. Необходимость дополнительного занятия и восстановление по журналу неизвестны.";
  if (definitions.length > exercises.length) reason += " Часть упражнений не включена из-за доступности оборудования или ограничений объёма.";
  return { date, source, reason, splitDay, scheduled, coachSupported: exercises.every(ex => !isAssisted(byId.get(ex.exerciseId))),
    plan: exercises.length ? { id: "daily", name, description: "", emoji: "", basedOnLevel: 0, basedOnLevelName: "", benchmarkKg: 0, isCustom: true, exercises } : null };
}

export function buildDailyChoices(state: OfflineState, now = new Date()): DailyWorkout[] {
  const last = lastWorkoutSplit(state, now.getTime());
  const preferred = buildDailyWorkout(state, now);
  const days = [preferred.splitDay, ...SPLIT_DAYS].filter((day, index, all): day is SplitDay =>
    day != null && day !== last && all.indexOf(day) === index);
  return days.map(day => day === preferred.splitDay ? preferred : buildDailyWorkout(state, now, day))
    .filter(choice => choice.plan != null).slice(0, 2);
}
