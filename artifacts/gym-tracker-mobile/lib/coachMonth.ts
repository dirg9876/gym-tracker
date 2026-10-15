import type { CoachContext } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";

export function monthProgress(state: OfflineState) {
  const saved = state.coachMonth;
  if (!saved) return null;
  const slots = saved.plan.weeks.flatMap(week => week.sessions.map((templateIndex, index) => ({ week: week.week, session: index + 1, focus: week.focus, template: saved.plan.templates[templateIndex] })));
  const completed = new Set(state.workouts.filter(workout => workout.finishedAt && workout.coachCycle?.planId === saved.id).map(workout => workout.coachCycle!.slot));
  return { saved, slots: slots.map((slot, index) => ({ ...slot, slot: index, completed: completed.has(index), unavailable: !slot.template.exercises.some(ex => state.exercises.some(item => item.id === ex.exerciseId && !item.deletedAt)) })) };
}

export function nextScheduledSession(state: OfflineState): CoachContext["scheduled"] {
  const progress = monthProgress(state);
  const next = progress?.slots.find(slot => !slot.completed);
  if (!progress || !next) return undefined;
  const exercises = next.template.exercises.filter(ex => state.exercises.some(item => item.id === ex.exerciseId && !item.deletedAt));
  if (!exercises.length) return undefined;
  return { planId: progress.saved.id, slot: next.slot, week: next.week, focus: next.focus, plan: { ...next.template, exercises } };
}
