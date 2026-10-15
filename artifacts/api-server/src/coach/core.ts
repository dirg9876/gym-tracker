import { createHash } from "node:crypto";
import { z } from "zod";
import { coachContextSchema, validateCoachReply } from "@workspace/ai-coach";
import { SqlCoachLedger, CoachHttpError } from "./ledgerCore.ts";
import { MODEL, PROMPT_VERSION, inputNanoUsd, outputNanoUsd, reserveCost, maxOutputTokens, type CoachProvider } from "./provider.ts";

const requestSchema = z.object({ id: z.string().min(16).max(100).regex(/^[a-zA-Z0-9:_.-]+$/), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), context: coachContextSchema }).strict();
export const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export async function processCoachRequest(body: unknown, ledger: SqlCoachLedger, provider: CoachProvider | null) {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) throw new CoachHttpError(400, "Неверный контекст тренировки.");
  const { id, context, fingerprint } = parsed.data;
  if (hash(JSON.stringify(context)) !== fingerprint) throw new CoachHttpError(400, "Контрольная сумма контекста не совпала.");
  if (!provider) throw new CoachHttpError(503, "На сервере не настроен ключ OpenAI. Платных запросов нет.");
  const cached = ledger.reserve(id, hash(`${MODEL}:${PROMPT_VERSION}:${fingerprint}`), reserveCost(context));
  if (cached) return { fingerprint, model: MODEL, result: JSON.parse(cached), budget: ledger.budget() };
  try {
    const output = await provider(context);
    const usage = z.object({ inputTokens: z.number().int().nonnegative().safe(), outputTokens: z.number().int().nonnegative().max(maxOutputTokens(context)) }).safeParse(output);
    if (!usage.success) throw new Error("Invalid provider usage");
    ledger.complete(id, output.inputTokens * inputNanoUsd + output.outputTokens * outputNanoUsd, null);
    if (!output.completed) throw new Error("Incomplete provider response");
    const result = validateCoachReply(JSON.parse(output.text), context);
    ledger.storeValidated(id, JSON.stringify(result));
    return { fingerprint, model: MODEL, result, budget: ledger.budget() };
  } catch {
    ledger.fail(id);
    throw new CoachHttpError(502, "ИИ не вернул проверенный ответ. Данные не изменены; повторный запрос может расходовать бюджет.");
  }
}
