import { defaultCoachProfile, personalCoachProfile, type CoachContext } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { nextScheduledSession } from "./coachMonth";
import { buildNextExercisePrediction } from "./trainingPrediction";
import { isTimedExercise, sameLoadCategory } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";
import type { TemplatePlan, TemplateExercise, SetTarget } from "./workoutTemplates";

export type DailyWorkout = {
  date: string; source: "month" | "template" | "balanced"; reason: string;
  plan: TemplatePlan | null; scheduled: CoachContext["scheduled"] | null; coachSupported: boolean;
};
export type DailyPreview = DailyWorkout & { fingerprint: string; activeWorkoutId: number | null };
type Definition = { exerciseId: number; sets: number; repsMin: number; repsMax: number; durationSeconds?: number; targetRir?: number; intent?: TemplateExercise["intent"]; note?: string | null };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function buildDailyWorkout(state: OfflineState, now = new Date()): DailyWorkout {
  const date = dateKey(now), timestamp = now.getTime();
  const profile = personalCoachProfile(state.coachProfile ?? defaultCoachProfile());
  const available = state.exercises.filter(ex => !ex.deletedAt && !ex.replacementPending && profile.equipment.includes(ex.equipment) && (!isAssisted(ex) || state.profile.bodyWeightKg != null));
  const byId = new Map(available.map(ex => [ex.id, ex]));
  const finished = state.workouts.filter(w => w.finishedAt && Date.parse(w.finishedAt) <= timestamp).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!) || a.id - b.id);
  const finishedIds = new Set(finished.map(w => w.id));
  const history = state.sets.filter(s => finishedIds.has(s.workoutId));
  const weeklyStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const weeklyIds = new Set(finished.filter(w => Date.parse(w.startedAt) >= weeklyStart).map(w => w.id));
  const groupWork = new Map<string, number>();
  for (const row of history.filter(s => weeklyIds.has(s.workoutId))) {
    const group = state.exercises.find(ex => ex.id === row.exerciseId)?.muscleGroup;
    if (group) groupWork.set(group, (groupWork.get(group) ?? 0) + 1);
  }
  const hasHistory = (id: number) => history.some(s => s.exerciseId === id && sameLoadCategory(s, byId.get(id)!) && (byId.get(id)!.equipment !== "dumbbell" || (s.dumbbellCount ?? 1) === (byId.get(id)!.dumbbellCount ?? 1)));
  let source: DailyWorkout["source"] = "balanced", name = "Тренировка на сегодня";
  let reason = history.length ? "Нагрузка распределена по основным группам с учётом записей за последние 7 дней. Рабочие цели рассчитаны по сопоставимой истории." : "Начальный сбалансированный вариант. Для незнакомых упражнений задан лёгкий подборочный подход, без проверки максимума.";
  let definitions: Definition[] = [];
  let scheduled = nextScheduledSession(state) ?? null;
  if (scheduled) {
    definitions = scheduled.plan.exercises.filter(ex => byId.has(ex.exerciseId)).map(ex => {
      const values = ex.targets.map(set => set.durationSeconds ?? set.reps);
      return { exerciseId: ex.exerciseId, sets: ex.targets.length, repsMin: Math.min(...values), repsMax: Math.max(...values), durationSeconds: ex.targets[0]?.durationSeconds ?? undefined, note: ex.reason };
    });
    if (definitions.length) { source = "month"; name = scheduled.plan.name; reason = `Следующее незавершённое занятие месячного плана · неделя ${scheduled.week}. Пропущенные занятия не списываются; нагрузки обновлены по истории.`; }
    else scheduled = null;
  }
  if (!definitions.length) {
    const templates = state.customPrograms.filter(p => p.exercises.some(ex => byId.has(ex.exerciseId))).slice().sort((a, b) => a.id - b.id);
    if (templates.length) {
      const last = finished.slice().reverse().find(w => templates.some(p => p.name === w.name));
      const lastIndex = templates.findIndex(p => p.name === last?.name);
      const load = (p: typeof templates[number]) => p.exercises.reduce((n, ex) => n + (groupWork.get(byId.get(ex.exerciseId)?.muscleGroup ?? "") ?? 0), 0) / Math.max(1, p.exercises.length);
      const selected = lastIndex >= 0 ? templates[(lastIndex + 1) % templates.length] : templates.slice().sort((a, b) => load(a) - load(b) || a.id - b.id)[0];
      source = "template"; name = selected.name;
      definitions = selected.exercises.filter(ex => byId.has(ex.exerciseId)).map(ex => ({ ...ex, durationSeconds: ex.setTargets?.[0]?.durationSeconds }));
      reason = lastIndex >= 0 ? "Следующий сохранённый вид тренировки после последнего выполненного. Веса и повторы пересчитаны по истории." : "Выбран сохранённый вид тренировки с меньшей записанной нагрузкой на его основные группы за 7 дней. Рабочие цели пересчитаны по истории.";
    }
  }
  if (!definitions.length) {
    const groups = [...new Set(available.map(ex => ex.muscleGroup))];
    const main = ["Ноги", "Спина", "Грудь", "Плечи", "Пресс"];
    const ordered = groups.sort((a, b) => (groupWork.get(a) ?? 0) - (groupWork.get(b) ?? 0) || (main.includes(a) ? main.indexOf(a) : 10) - (main.includes(b) ? main.indexOf(b) : 10) || a.localeCompare(b, "ru"));
    const favorites = ["Жим ногами", "Тяга верхнего блока", "Жим гантелей лёжа", "Жим гантелей сидя", "Скручивания"];
    for (const group of ordered.slice(0, 5)) {
      const candidates = available.filter(ex => ex.muscleGroup === group && (!isAssisted(ex) || hasHistory(ex.id)));
      candidates.sort((a, b) => Number(hasHistory(b.id)) - Number(hasHistory(a.id)) || Number(favorites.includes(b.name)) - Number(favorites.includes(a.name)) || a.id - b.id);
      const chosen = candidates[0];
      if (chosen) definitions.push({ exerciseId: chosen.id, sets: hasHistory(chosen.id) ? 3 : 2, repsMin: profile.goal === "strength" ? 3 : 8, repsMax: profile.goal === "strength" ? 6 : 12 });
    }
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
    const last = compatible.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id).at(-1);
    const calibration = !timed && !isAssisted(exercise) && (prediction.next.action === "calibrate" || !compatible.length);
    const targets: SetTarget[] = Array.from({ length: count }, (_, i) => {
      if (timed) return { weightKg: 0, reps: 0, durationSeconds: last?.durationSeconds ?? definition.durationSeconds ?? 30, setType: "working" };
      if (isAssisted(exercise)) return { weightKg: Math.min(last?.weightKg ?? 20, state.profile.bodyWeightKg!), reps: Math.min(last?.reps ?? 6, definition.repsMax), setType: "working" };
      const result = prediction.model.targets[i] ?? prediction.next;
      return { weightKg: result.weightKg, reps: exercise.equipment === "bodyweight" && calibration ? 3 : result.reps, setType: "working" };
    });
    const values = targets.map(s => s.durationSeconds ?? s.reps);
    exercises.push({ exerciseId: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, isBodyweight: exercise.equipment === "bodyweight", basedOn: "personal-record", suggestedWeightKg: targets[0].weightKg,
      sets: count, repsMin: timed ? Math.min(...values) : definition.repsMin, repsMax: timed ? Math.max(...values) : definition.repsMax,
      intent: definition.intent ?? (profile.goal === "strength" ? "strength" : "hypertrophy"), weightStepKg: exercise.weightStepKg ?? 2.5, targetRir: definition.targetRir ?? 2,
      calibration, note: timed ? "Удержание в секундах, без веса." : isAssisted(exercise) ? "Противовес подбирается вручную, без автоматического повышения." : prediction.next.reason, setTargets: targets });
    remainingSets -= count;
  }
  if (finished.some(w => dateKey(new Date(w.startedAt)) === date)) reason += " Сегодня уже записана тренировка. Необходимость дополнительного занятия и восстановление по журналу неизвестны.";
  if (definitions.length > exercises.length) reason += " Часть упражнений не включена из-за доступности оборудования или ограничений объёма.";
  return { date, source, reason, scheduled, coachSupported: exercises.every(ex => !isAssisted(byId.get(ex.exerciseId))),
    plan: exercises.length ? { id: "daily", name, description: "", emoji: "", basedOnLevel: 0, basedOnLevelName: "", benchmarkKg: 0, isCustom: true, exercises } : null };
}
