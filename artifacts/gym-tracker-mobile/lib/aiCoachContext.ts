import { coachContextSchema, defaultCoachProfile, jsonByteLength, personalCoachProfile, type CoachContext, type CoachMessages, type CoachTask } from "@workspace/ai-coach";
import { buildTrainingAnalysis } from "./trainingAnalysis";
import { buildActivePrediction, buildNextExercisePrediction } from "./trainingPrediction";
import { buildDailyWorkout } from "./dailyWorkout";
import type { OfflineState } from "./offlineApi";
import { isTimedExercise, sameLoadCategory } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";
import { completedTargets, plannedSet, type TemplatePlan } from "./workoutTemplates";
import { nextScheduledSession } from "./coachMonth";

export function buildCoachContext(state: OfflineState, task: CoachTask, workoutId?: number, messages?: CoachMessages, plan?: TemplatePlan | null, trainingMode?: "regular" | "office"): CoachContext {
  const focus = workoutId ? state.workouts.find(w => w.id === workoutId) : undefined;
  trainingMode = focus?.trainingMode ?? trainingMode;
  if (workoutId && !focus) throw new Error("Тренировка не найдена.");
  if (task === "next_set" && (!focus || focus.finishedAt || !focus.draft)) throw new Error("Сначала выберите упражнение в текущей тренировке.");
  if (task === "review" && (!focus?.finishedAt)) throw new Error("Сначала завершите тренировку.");
  if (task === "adjust_workout" && (!focus || focus.finishedAt)) throw new Error("Сначала откройте текущую тренировку.");
  // The current gateway contract has no counterweight semantics. Never send it as external load.
  const available = state.exercises.filter(ex => !ex.deletedAt && !isAssisted(ex));
  if (task === "next_set" && focus?.draft && isAssisted(state.exercises.find(ex => ex.id === focus.draft!.exerciseId))) throw new Error("Подбор противовеса пока доступен вручную.");
  const catalog = available.slice(0, 120).map(ex => ({ id: ex.id, name: ex.name.slice(0, 120), muscleGroup: ex.muscleGroup.slice(0, 120), equipment: ex.equipment, timed: isTimedExercise(ex.name), weightStepKg: ex.weightStepKg ?? 2.5, ...(ex.equipment === "dumbbell" ? { dumbbellCount: ex.dumbbellCount ?? 1 } : {}) }));
  const ids = new Set(catalog.map(ex => ex.id));
  const finished = state.workouts.filter(w => w.finishedAt && (task !== "review" || w.finishedAt <= focus!.finishedAt!)).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!) || a.id - b.id);
  const sessions = finished.slice(-12);
  if (focus && !sessions.some(w => w.id === focus.id)) sessions.push(focus);
  sessions.sort((a, b) => (a.finishedAt ?? "9999").localeCompare(b.finishedAt ?? "9999"));
  const sessionIds = new Set(sessions.map(w => w.id));
  const eligible = state.sets.filter(set => {
    const exercise = available.find(ex => ex.id === set.exerciseId);
    return sessionIds.has(set.workoutId) && ids.has(set.exerciseId) && set.weightKg <= 2000 && set.reps <= 100 && !!exercise && sameLoadCategory(set, exercise) && (exercise.equipment !== "dumbbell" || (set.dumbbellCount ?? 1) === (exercise.dumbbellCount ?? 1));
  });
  const recentSets = eligible.slice(-160);
  const prepared = task === "next_workout" && trainingMode !== "office" ? buildDailyWorkout(state) : null;
  const calibrationEstimates = task !== "next_set" && task !== "review" && trainingMode !== "office" ? available.slice(0, 120).flatMap(ex => {
    const prediction = buildNextExercisePrediction(state, ex.id, Date.now());
    return prediction.calibrationBasis ? [prediction.calibrationBasis] : [];
  }) : [];
  const loadTargets = task !== "next_set" && task !== "review" && trainingMode !== "office" ? available.slice(0, 120).map(ex => {
    const definition = prepared?.plan?.exercises.find(row => row.exerciseId === ex.id) ?? plan?.exercises.find(row => row.exerciseId === ex.id);
    const prediction = task === "adjust_workout" && focus ? buildActivePrediction(state, focus.id, ex.id, Date.now(), definition) : buildNextExercisePrediction(state, ex.id, Date.now(), definition);
    const timed = isTimedExercise(ex.name);
    const seconds = state.sets.filter(set => set.exerciseId === ex.id && set.durationSeconds != null && sameLoadCategory(set, ex) && finished.some(w => w.id === set.workoutId)).at(-1)?.durationSeconds ?? 30;
    const targets = Array.from({ length: 6 }, (_, i) => {
      const numeric = prediction.model.targets[i] ?? prediction.next;
      return timed ? { weightKg: 0, reps: 0, durationSeconds: seconds } : { weightKg: numeric.weightKg, reps: ex.equipment === "bodyweight" && prediction.next.action === "calibrate" ? 3 : numeric.reps, durationSeconds: null };
    });
    return { exerciseId: ex.id, targets, calibration: !timed && prediction.next.action === "calibrate", reason: prediction.next.reason };
  }).filter(row => row.targets[0].durationSeconds == null) : [];
  const observation = (set: { exerciseId: number; weightKg: number; reps: number; durationSeconds?: number; rir?: number | null; technique?: "good" | "breakdown" | null }) => ({ exerciseId: set.exerciseId, weightKg: set.weightKg, reps: set.reps, durationSeconds: set.durationSeconds ?? null, rir: set.rir ?? null, technique: set.technique ?? null });
  const context = coachContextSchema.parse({
    loadSelection: "calibration-v1",
    version: 1, task, preferences: trainingMode === "office" ? { ...personalCoachProfile(state.coachProfile ?? defaultCoachProfile()), sessionMinutes: 20, equipment: ["bodyweight"] } : personalCoachProfile(state.coachProfile ?? defaultCoachProfile()),
    athlete: { sex: state.profile.bodyWeightKg == null ? null : state.profile.sex ?? null, bodyWeightKg: state.profile.bodyWeightKg },
    catalog, sessions: sessions.map(w => ({ id: w.id, finishedAt: w.finishedAt, sets: recentSets.filter(set => set.workoutId === w.id).map(observation) })),
    focus: focus ? { workoutId: focus.id, finished: !!focus.finishedAt, draftRevision: focus.draftRevision ?? 0, draft: focus.draft && ids.has(focus.draft.exerciseId) ? observation(focus.draft) : null, ...(task === "adjust_workout" ? { performedSetCount: state.sets.filter(set => set.workoutId === focus.id).length } : {}) } : null,
    programs: state.customPrograms.slice(-3).map(program => ({ name: program.name.slice(0, 80), exercises: program.exercises.slice(0, 20).map(ex => ({ exerciseId: ex.exerciseId, sets: ex.sets, repsMin: ex.repsMin, repsMax: ex.repsMax })) })),
    truncated: available.length > catalog.length || finished.length > 12 || eligible.length > recentSets.length || state.sets.filter(set => sessionIds.has(set.workoutId)).length !== eligible.length,
    ...(task !== "next_set" ? { analysis: buildTrainingAnalysis(state, task === "review" ? workoutId : undefined) } : {}),
    ...(prepared?.plan && prepared.coachSupported ? { preparedWorkout: { name: prepared.plan.name, description: prepared.plan.description, exercises: prepared.plan.exercises.filter(ex => ids.has(ex.exerciseId)).map(ex => ({ exerciseId: ex.exerciseId, reason: (ex.note || "Локальный план").slice(0, 400), targets: ex.setTargets!.map(set => ({ weightKg: set.weightKg, reps: set.reps, durationSeconds: set.durationSeconds ?? null })) })) } } : {}),
    ...(calibrationEstimates.length ? { calibrationEstimates } : {}),
    ...(loadTargets.length ? { loadTargets } : {}),
    ...(task === "next_set" && focus?.draft && !isTimedExercise(available.find(ex => ex.id === focus.draft!.exerciseId)?.name ?? "") ? (() => {
      const forecast = buildActivePrediction(state, focus.id, focus.draft!.exerciseId, Date.now(), plan?.exercises.find(row => row.exerciseId === focus.draft!.exerciseId));
      return { nextSetTarget: { exerciseId: forecast.exerciseId, ...forecast.next, model: forecast.model } };
    })() : {}),
    ...(messages ? { messages } : {}),
    ...(trainingMode ? { trainingMode } : {}),
    ...(task === "next_workout" && trainingMode !== "office" && nextScheduledSession(state) ? { scheduled: nextScheduledSession(state) } : {}),
    ...(task === "adjust_workout" ? { remainingPlan: (plan?.exercises ?? []).filter(ex => ids.has(ex.exerciseId)).slice(0, 120).map(ex => {
      const done = completedTargets(ex, state.sets.filter(set => set.workoutId === workoutId));
      return { exerciseId: ex.exerciseId, targets: Array.from({ length: Math.min(100, ex.sets - done) }, (_, i) => {
        const set = plannedSet(ex, done + i);
        return { weightKg: Number.isFinite(set.weightKg) ? set.weightKg : null, reps: set.reps, durationSeconds: set.durationSeconds ?? null };
      }) };
    }).filter(ex => ex.targets.length) } : {}),
  });
  while (jsonByteLength(context) > 58000) {
    const first = context.sessions.find(session => session.sets.length > 0);
    if (first) first.sets.shift();
    else if (context.analysis?.exercises.length) { context.analysis.exercises.pop(); context.analysis.omittedExercises++; }
    else {
      const required = new Set([context.focus?.draft?.exerciseId, ...context.programs.flatMap(row => row.exercises.map(ex => ex.exerciseId)), ...(context.scheduled?.plan.exercises.map(ex => ex.exerciseId) ?? []), ...(context.remainingPlan?.map(ex => ex.exerciseId) ?? []), ...(context.preparedWorkout?.exercises.map(ex => ex.exerciseId) ?? []), ...(context.calibrationEstimates?.flatMap(ex => [ex.exerciseId, ex.sourceExerciseId]) ?? [])]);
      let removable = context.catalog.length - 1;
      while (removable >= 0 && required.has(context.catalog[removable].id)) removable--;
      if (removable < 0) throw new Error("Каталог и план слишком велики для анализа. Оставьте в тренировке меньше упражнений.");
      context.catalog.splice(removable, 1);
      context.loadTargets = context.loadTargets?.filter(row => context.catalog.some(ex => ex.id === row.exerciseId));
      context.calibrationEstimates = context.calibrationEstimates?.filter(row => context.catalog.some(ex => ex.id === row.exerciseId) && context.catalog.some(ex => ex.id === row.sourceExerciseId));
    }
    context.truncated = true;
  }
  return context;
}
