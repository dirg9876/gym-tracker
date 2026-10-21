import { coachContextSchema, defaultCoachProfile, personalCoachProfile, type CoachContext, type CoachMessages, type CoachTask } from "@workspace/ai-coach";
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
  const catalog = available.slice(0, 120).map(ex => ({ id: ex.id, name: ex.name.slice(0, 120), muscleGroup: ex.muscleGroup.slice(0, 120), equipment: ex.equipment, timed: isTimedExercise(ex.name) }));
  const ids = new Set(catalog.map(ex => ex.id));
  const finished = state.workouts.filter(w => w.finishedAt).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!));
  const sessions = finished.slice(-12);
  if (focus && !sessions.some(w => w.id === focus.id)) sessions.push(focus);
  sessions.sort((a, b) => (a.finishedAt ?? "9999").localeCompare(b.finishedAt ?? "9999"));
  const sessionIds = new Set(sessions.map(w => w.id));
  const eligible = state.sets.filter(set => sessionIds.has(set.workoutId) && ids.has(set.exerciseId) && sameLoadCategory(set, available.find(ex => ex.id === set.exerciseId)!));
  const recentSets = eligible.slice(-160);
  const observation = (set: { exerciseId: number; weightKg: number; reps: number; durationSeconds?: number; rir?: number | null; technique?: "good" | "breakdown" | null }) => ({ exerciseId: set.exerciseId, weightKg: set.weightKg, reps: set.reps, durationSeconds: set.durationSeconds ?? null, rir: set.rir ?? null, technique: set.technique ?? null });
  return coachContextSchema.parse({
    loadSelection: "calibration-v1",
    version: 1, task, preferences: trainingMode === "office" ? { ...personalCoachProfile(state.coachProfile ?? defaultCoachProfile()), sessionMinutes: 20, equipment: ["bodyweight"] } : personalCoachProfile(state.coachProfile ?? defaultCoachProfile()),
    athlete: { sex: state.profile.bodyWeightKg == null ? null : state.profile.sex ?? null, bodyWeightKg: state.profile.bodyWeightKg },
    catalog, sessions: sessions.map(w => ({ id: w.id, finishedAt: w.finishedAt, sets: recentSets.filter(set => set.workoutId === w.id).map(observation) })),
    focus: focus ? { workoutId: focus.id, finished: !!focus.finishedAt, draftRevision: focus.draftRevision ?? 0, draft: focus.draft && ids.has(focus.draft.exerciseId) ? observation(focus.draft) : null, ...(task === "adjust_workout" ? { performedSetCount: state.sets.filter(set => set.workoutId === focus.id).length } : {}) } : null,
    programs: state.customPrograms.slice(-3).map(program => ({ name: program.name.slice(0, 80), exercises: program.exercises.slice(0, 20).map(ex => ({ exerciseId: ex.exerciseId, sets: ex.sets, repsMin: ex.repsMin, repsMax: ex.repsMax })) })),
    truncated: available.length > catalog.length || finished.length > 12 || eligible.length > recentSets.length || state.sets.filter(set => sessionIds.has(set.workoutId)).length !== eligible.length,
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
}
