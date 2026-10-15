import * as SecureStore from "expo-secure-store";
import { z } from "zod";

export const DEFAULT_COACH_URL = "https://gym-beam-coach.dirg9876.workers.dev";
export const AI_CREDENTIAL_KEY = "gymbeam.ai-coach.connection.v1";
export const MAX_CONNECTION_FILE_BYTES = 8192;
const options: SecureStore.SecureStoreOptions = {
  keychainService: "gymbeam-ai-coach",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function coachGatewayUrl(value: string) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new Error("Укажите HTTPS-адрес личного шлюза.");
  return url.toString().replace(/\/$/, "");
}
const credentialSchema = z.object({
  url: z.string().max(300).transform(coachGatewayUrl),
  token: z.string().trim().min(32).max(256).regex(/^[A-Za-z0-9._~+-]+$/).refine(value => !value.startsWith("sk-")),
}).strict();
export type AiCoachCredential = z.infer<typeof credentialSchema>;
const fileSchema = credentialSchema.extend({ format: z.literal("gym-beam-coach-connection"), version: z.literal(1) }).strict();

export function parseAiCoachConnectionFile(text: string): AiCoachCredential {
  try {
    if (text.length > MAX_CONNECTION_FILE_BYTES) throw new Error();
    const { url, token } = fileSchema.parse(JSON.parse(text));
    return { url, token };
  } catch { throw new Error("Неверный файл подключения тренера. Нужен личный файл gym-beam-coach-connection.json, не резервная копия и не ключ OpenAI."); }
}
export function validateAiCoachCredential(value: AiCoachCredential): AiCoachCredential {
  try { return credentialSchema.parse(value); }
  catch { throw new Error("Проверьте адрес и личный токен шлюза. Ключ OpenAI сюда вводить нельзя."); }
}
export async function readAiCoachCredential(): Promise<AiCoachCredential | null> {
  const raw = await SecureStore.getItemAsync(AI_CREDENTIAL_KEY, options);
  if (raw == null) return null;
  try { return credentialSchema.parse(JSON.parse(raw)); }
  catch { throw new Error("Сохранённое подключение повреждено. Укажите адрес и токен заново."); }
}
export async function saveAiCoachCredential(value: AiCoachCredential | null) {
  if (value) await SecureStore.setItemAsync(AI_CREDENTIAL_KEY, JSON.stringify(validateAiCoachCredential(value)), options);
  else await SecureStore.deleteItemAsync(AI_CREDENTIAL_KEY, options);
}
