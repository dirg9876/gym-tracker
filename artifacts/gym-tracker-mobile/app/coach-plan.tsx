import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { Workout } from "@workspace/api-client-react";
import { SavedWorkoutPlan } from "@/components/SavedWorkoutPlan";
import { clearCoachProposal, getCoachProposal, getCoachSessionProposal } from "@/lib/aiCoachPlan";
import { loadAiContext } from "@/hooks/useAiCoach";
import { assertCoachAnswerCurrent } from "@/lib/aiCoachConnection";
import { coachRequest } from "@/lib/coachApi";

export default function CoachPlanScreen() {
  const [plan] = useState(getCoachProposal);
  const [session] = useState(getCoachSessionProposal);
  const router = useRouter();
  const client = useQueryClient();
  return plan ? <SavedWorkoutPlan plan={plan} onSaved={clearCoachProposal} confirmation={session ? {
    title: session.context.task === "adjust_workout" ? "Оставшиеся упражнения" : "Тренировка с ИИ",
    label: session.context.task === "adjust_workout" ? "Применить оставшийся план" : "Начать эту тренировку",
    apply: async edited => {
      const { context, envelope } = session;
      await assertCoachAnswerCurrent(envelope, await loadAiContext(context.task, context.focus?.workoutId, context.messages, context.trainingMode));
      const workout = await coachRequest<Workout>("/api/ai-coach/apply-plan", "POST", { context, fingerprint: envelope.fingerprint, plan: edited });
      await client.invalidateQueries();
      router.replace(`/workout/${workout.id}`);
    },
  } : undefined} /> : <Redirect href="/coach" />;
}
