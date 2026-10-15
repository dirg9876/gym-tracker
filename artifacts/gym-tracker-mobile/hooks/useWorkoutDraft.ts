import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGetActiveWorkoutQueryKey, getGetWorkoutQueryKey, type WorkoutSet } from "@workspace/api-client-react";
import { coachRequest } from "@/lib/coachApi";
import { retryDraftAction, sameDraft, type DraftResponse, type WorkoutDraft } from "@/lib/workoutDraft";
import type { TrainingTimer } from "@/lib/trainingCoach";

export function useWorkoutDraft(workoutId: number) {
  const client = useQueryClient();
  const key = useMemo(() => ["workout-draft", workoutId], [workoutId]);
  const url = `/api/workouts/${workoutId}/draft`;
  const query = useQuery({ queryKey: key, queryFn: () => coachRequest<DraftResponse>(url), enabled: !!workoutId, refetchOnMount: "always" });
  const latest = useRef<DraftResponse | undefined>(query.data);
  const pending = useRef(false);
  const retryAction = useRef<(() => Promise<unknown>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committedSetId, setCommittedSetId] = useState(0);
  useEffect(() => { if (!pending.current && query.data) latest.current = query.data; }, [query.data]);

  const apply = useCallback((result: DraftResponse) => {
    const snapshot = { draft: result.draft, revision: result.revision };
    latest.current = snapshot;
    client.setQueryData(key, snapshot);
  }, [client, key]);

  const run = async <T extends DraftResponse>(action: (current: DraftResponse) => Promise<T>, optimistic?: WorkoutDraft): Promise<T> => {
    if (pending.current || !latest.current) throw new Error("Дождитесь сохранения черновика.");
    const current = latest.current;
    pending.current = true;
    retryAction.current = () => run(action, optimistic);
    setSaving(true);
    setError(null);
    if (optimistic) apply({ ...current, draft: optimistic });
    try {
      const result = await action(current);
      apply(result);
      retryAction.current = null;
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить черновик.");
      throw error;
    } finally { pending.current = false; setSaving(false); }
  };

  const save = (draft: WorkoutDraft, expected?: { revision: number; coachFingerprint: string }) => run(async current => {
    if (expected && expected.revision !== current.revision) throw new Error("Черновик изменился. Запросите новый совет.");
    try { return await coachRequest<DraftResponse>(url, "PUT", { draft, revision: current.revision, ...(expected ? { coachFingerprint: expected.coachFingerprint } : {}) }); }
    catch (error) {
      // A native write can commit before its acknowledgement is lost.
      try {
        const stored = await coachRequest<DraftResponse>(url);
        if (sameDraft(stored.draft, draft)) return stored;
      } catch { /* Keep the unsaved input visible for an explicit retry. */ }
      throw error;
    }
  }, expected ? undefined : draft);

  const reload = async () => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      apply(await coachRequest<DraftResponse>(url)); setError(null); retryAction.current = null;
      void client.invalidateQueries({ queryKey: ["coach-timer", workoutId] });
    }
    catch (error) { setError(error instanceof Error ? error.message : "Не удалось прочитать черновик."); throw error; }
    finally { pending.current = false; setSaving(false); }
  };

  return {
    value: query.data?.draft ?? null,
    ready: !!query.data && !query.isFetching,
    saving,
    committedSetId,
    error: error ?? (query.isError ? query.error.message : null),
    save,
    reload,
    retry: () => retryAction.current ? retryAction.current() : reload(),
    commit: async () => {
      const result = await run(async current => {
        const result = await retryDraftAction(() => coachRequest<DraftResponse & { set: WorkoutSet }>(`${url}/commit`, "POST", { revision: current.revision }));
        setCommittedSetId(result.set.id);
        void client.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
        void client.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        return result;
      });
      return result.set;
    },
    transfer: (timer: TrainingTimer) => run(async current => {
      const result = await retryDraftAction(() => coachRequest<DraftResponse & { timer: null; restSeconds: number }>(`${url}/transfer`, "POST", { timer, revision: current.revision }));
      client.setQueryData(["coach-timer", workoutId], { timer: result.timer, restSeconds: result.restSeconds });
      return result;
    }),
  };
}
