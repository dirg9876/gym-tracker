import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { COACH_EVIDENCE, COACH_INSTRUCTIONS, coachMonthReplySchema, coachReplySchema, coachReviewReplySchema, type CoachContext } from "@workspace/ai-coach";

export const MODEL = "gpt-6-luna";
export const PROMPT_VERSION = "coach-v10-goal-evidence";
export const MAX_OUTPUT_TOKENS = 2400;
export const maxOutputTokens = (context: CoachContext) => context.task === "month_plan" ? 6000 : context.task === "review" && context.analysis ? 4800 : MAX_OUTPUT_TOKENS;
export type ProviderResult = { text: string; inputTokens: number; outputTokens: number; completed: boolean };
export type CoachProvider = (context: CoachContext) => Promise<ProviderResult>;
export const inputNanoUsd = 100;
export const outputNanoUsd = 500;

export function coachBody(context: CoachContext) {
  const exerciseId = context.focus?.draft?.exerciseId;
  const observations = context.sessions.flatMap(session => session.sets).filter(set => set.exerciseId === exerciseId);
  const focusEvidence = exerciseId == null ? null : {
    exerciseId, recordedSetCount: observations.length, recentRecordedSets: observations.slice(-3), draftIsPerformedSet: false,
  };
  const reviewEvidence = context.task === "review" ? context.analysis?.exercises.map(row => ({ exerciseKey: row.key, currentCategory: row.matchesCurrentCategory, permittedAction: row.next.action, exactTarget: row.next, range: row.range })) ?? null : null;
  return {
    model: MODEL, service_tier: "default" as const, store: false, reasoning: { effort: "none" as const }, max_output_tokens: maxOutputTokens(context),
    instructions: `${COACH_INSTRUCTIONS}
When preparedWorkout is supplied, analyze that already computed workout instead of designing an unrelated one. Explain its fit to the history and goal. Return plan=null if no justified change is needed; otherwise return the complete corrected workout, not a fragment. The user can start the local workout without waiting for your answer. Do not claim that it is their appointed weekday when no actual calendar schedule exists. For new movements, use calibrationEstimates verbatim, including the per-dumbbell convention. Their coefficients are explicitly conservative calibration heuristics, not validated personal ratios or official ranks. They require a first assessed set. Prioritize own exercise observations over analogs; never infer a leg press or a lateral raise from an unrelated muscle group or a heavy single. For month_plan fill numeric targets from local estimates, not generic 2.5 kg when a supported estimate exists. No arbitrary weekly weight increments.
Use focusEvidence as a deterministic index of the recorded observations, not as additional measurements. When recordedSetCount>0, never claim there is no performed set for that exercise. Timed observations with positive durationSeconds are completed work even though reps=0. Distinguish the current unperformed draft from recorded sets. Refer to supplied durations and counts accurately; do not invent missing feedback.
sessionMinutes is a preference, not a verified duration estimate. Allow for preparation, rests and transitions. Choose a conservative plan and do not claim it fits an exact duration when rest times are unknown.
For a structured review, reviewEvidence is the authoritative next-session decision. Follow permittedAction exactly: hold means repeat the target, not add reps; progress_reps means the supplied one-rep target; reduce means the supplied lighter target; calibrate means assess the first set. Do not advise adding reps beyond range.repsMax, including when the observed set already exceeded that range. Explain why the action is appropriate. The UI shows the exact numeric target, so do not invent or contradict it. When currentCategory=false, discuss historical performance only and say the changed equipment needs fresh calibration.
The local epley-rir-ema-v1 mathematical model owns numeric loads and repetitions. Your role is analysis, checking limitations, exercise selection and proposed personal adjustments for user confirmation, not replacing model values. Use nextSetTarget verbatim for next_set. In plans use matching analysis.exercises[].model.targets when ready; never invent future weekly load increases. Explain discrepancies, suggest calibration or a user-approved range change if appropriate. e1RM is an estimate, NEVER a lifted record, rank, diagnosis or measured recovery. Rep MAE is walk-forward conditional on self-reported actual RIR, not guaranteed prospective accuracy. rirErrorMAE=null means prescribed-RIR error is unavailable. fatigueBeta=null means no fitted fatigue coefficient; do not invent beta=1 or a rest time. Machines are comparable only on the same equipment; bodyweight, assistance, seconds and other equipment have no Epley prediction.`,
    input: JSON.stringify({ context, focusEvidence, reviewEvidence, research: COACH_EVIDENCE }),
    text: { format: context.task === "month_plan" ? zodTextFormat(coachMonthReplySchema, "gymbeam_month") : context.task === "review" && context.analysis ? zodTextFormat(coachReviewReplySchema, "gymbeam_review") : zodTextFormat(coachReplySchema, "gymbeam_coach") },
  };
}
export function reserveCost(context: CoachContext) {
  // UTF-8 byte count is deliberately more conservative than typical tokenization.
  return (Buffer.byteLength(JSON.stringify(coachBody(context)), "utf8") + 8192) * inputNanoUsd + maxOutputTokens(context) * outputNanoUsd;
}
export function openAiProvider(apiKey: string, transport?: typeof fetch): CoachProvider {
  const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1", timeout: 45000, maxRetries: 0, logLevel: "off", ...(transport ? { fetch: transport } : {}) });
  return async context => {
    const response = await client.responses.create(coachBody(context));
    if (!response.usage) throw new Error("Missing provider usage");
    return { text: response.output_text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, completed: response.status === "completed" };
  };
}
