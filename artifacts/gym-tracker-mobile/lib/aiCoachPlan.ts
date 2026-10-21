import { calibrationWeight, coachNeedsCalibration, lastCoachObservation, type CoachContext, type CoachEnvelope, type CoachReply } from "@workspace/ai-coach";
import type { TemplatePlan } from "./workoutTemplates";

let proposal: TemplatePlan | null = null;
let sessionProposal: { context: CoachContext; envelope: CoachEnvelope } | null = null;
let monthProposal: { context: CoachContext; envelope: CoachEnvelope } | null = null;
export const getCoachMonthProposal = () => monthProposal;
export const setCoachMonthProposal = (envelope: CoachEnvelope, context: CoachContext) => { monthProposal = { context, envelope }; };
export const clearCoachMonthProposal = () => { monthProposal = null; };
export const getCoachProposal = () => proposal;
export const getCoachSessionProposal = () => sessionProposal;
export const clearCoachProposal = () => { proposal = null; sessionProposal = null; monthProposal = null; };
export function setCoachProposal(reply: CoachReply, context: CoachContext, envelope?: CoachEnvelope) {
  if (!reply.plan) throw new Error("ИИ не предложил план.");
  proposal = {
    id: "new", name: reply.plan.name, description: reply.plan.description, emoji: "",
    basedOnLevel: 0, basedOnLevelName: "", benchmarkKg: 0, isCustom: true,
    exercises: reply.plan.exercises.map(row => {
      const exercise = context.catalog.find(ex => ex.id === row.exerciseId);
      if (!exercise) throw new Error("Упражнение больше недоступно.");
      const values = row.targets.map(set => set.durationSeconds ?? set.reps);
      return {
        exerciseId: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment,
        isBodyweight: exercise.equipment === "bodyweight", basedOn: "personal-record", suggestedWeightKg: row.targets[0].weightKg ?? lastCoachObservation(context, exercise.id)?.weightKg ?? calibrationWeight(exercise.equipment),
        calibration: coachNeedsCalibration(context, exercise.id),
        sets: row.targets.length, repsMin: Math.min(...values), repsMax: Math.max(...values),
        intent: context.preferences.goal === "strength" ? "strength" : "hypertrophy", note: row.reason,
        weightStepKg: exercise.weightStepKg ?? 2.5, targetRir: 2,
        setTargets: row.targets.map(set => ({ weightKg: set.weightKg ?? lastCoachObservation(context, exercise.id)?.weightKg ?? calibrationWeight(exercise.equipment), reps: set.reps, ...(set.durationSeconds == null ? {} : { durationSeconds: set.durationSeconds }), setType: "working" })),
      };
    }),
  };
  sessionProposal = envelope ? { context, envelope } : null;
  return proposal;
}
