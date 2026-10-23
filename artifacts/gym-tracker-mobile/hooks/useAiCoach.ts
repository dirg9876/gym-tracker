import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import type { CoachContext, CoachEnvelope, CoachMessages, CoachTask } from "@workspace/ai-coach";
import { coachRequest } from "@/lib/coachApi";
import { assertCoachAnswerCurrent, readAiConnection, requestAiCoach } from "@/lib/aiCoachConnection";
import type { SplitDay } from "@/lib/adaptiveWorkout";

export const AI_CONNECTION_QUERY = ["ai-connection"];
export const AI_BUDGET_QUERY = ["ai-budget"];
export function useAiConnection() {
  const query = useQuery({ queryKey: AI_CONNECTION_QUERY, queryFn: readAiConnection, retry: false });
  useFocusEffect(useCallback(() => { void query.refetch(); }, [query.refetch]));
  return query;
}
export function loadAiContext(task: CoachTask, workoutId?: number, messages?: CoachMessages, trainingMode?: "regular" | "office", splitDay?: SplitDay) {
  return coachRequest<CoachContext>("/api/ai-coach/context", "POST", { task, workoutId, messages, trainingMode, splitDay });
}
export function useAiCoach(task: CoachTask, workoutId?: number, contextKey = "", trainingMode?: "regular" | "office", splitDay?: SplitDay) {
  const client = useQueryClient();
  const connection = useAiConnection();
  const [answer, setAnswer] = useState<{ envelope: CoachEnvelope; context: CoachContext } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const currentKey = useRef(contextKey);
  currentKey.current = contextKey;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setAnswer(null); setError(null); }, [task, workoutId, contextKey, connection.data?.enabled, connection.data?.connected]);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Не удалось получить совет."); }
    finally { pending.current = false; setBusy(false); }
  };
  const validate = async () => {
    if (!answer) throw new Error("Запросите новый совет.");
    const context = await loadAiContext(task, workoutId, answer.context.messages, trainingMode, splitDay);
    await assertCoachAnswerCurrent(answer.envelope, context);
    return context;
  };
  return {
    enabled: !!connection.data?.enabled && !!connection.data?.connected,
    answer, busy, error,
    ask: (messages?: CoachMessages) => run(async () => {
      setAnswer(null);
      const key = currentKey.current;
      const context = await loadAiContext(task, workoutId, messages, trainingMode, splitDay);
      const envelope = await requestAiCoach(context);
      client.setQueryData(AI_BUDGET_QUERY, envelope.budget);
      await assertCoachAnswerCurrent(envelope, await loadAiContext(task, workoutId, messages, trainingMode, splitDay));
      if (key !== currentKey.current) throw new Error("Тренировка изменилась. Запросите новый совет.");
      if (!mounted.current) return;
      setAnswer({ envelope, context });
    }),
    apply: (action: (answer: CoachEnvelope, context: CoachContext) => Promise<void>) => run(async () => {
      const context = await validate();
      await action(answer!.envelope, context);
      setAnswer(null);
    }),
  };
}
