import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { COACH_EVIDENCE, COACH_INSTRUCTIONS, coachMonthReplySchema, coachReplySchema, type CoachContext } from "@workspace/ai-coach";

export const MODEL = "gpt-6-luna";
export const PROMPT_VERSION = "coach-v5-calibration-goals";
export const MAX_OUTPUT_TOKENS = 2400;
export const maxOutputTokens = (context: CoachContext) => context.task === "month_plan" ? 6000 : MAX_OUTPUT_TOKENS;
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
  return {
    model: MODEL, service_tier: "default" as const, store: false, reasoning: { effort: "none" as const }, max_output_tokens: maxOutputTokens(context),
    instructions: `${COACH_INSTRUCTIONS}
Use focusEvidence as a deterministic index of the recorded observations, not as additional measurements. When recordedSetCount>0, never claim there is no performed set for that exercise. Timed observations with positive durationSeconds are completed work even though reps=0. Distinguish the current unperformed draft from recorded sets. Refer to supplied durations and counts accurately; do not invent missing feedback.
sessionMinutes is a preference, not a verified duration estimate. Allow for preparation, rests and transitions. Choose a conservative plan and do not claim it fits an exact duration when rest times are unknown.`,
    input: JSON.stringify({ context, focusEvidence, research: COACH_EVIDENCE }),
    text: { format: context.task === "month_plan" ? zodTextFormat(coachMonthReplySchema, "gymbeam_month") : zodTextFormat(coachReplySchema, "gymbeam_coach") },
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
