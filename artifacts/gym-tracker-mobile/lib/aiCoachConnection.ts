import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { z } from "zod";
import { coachContextSchema, coachEnvelopeSchema, validateCoachReply, type CoachContext, type CoachEnvelope } from "@workspace/ai-coach";
import { DEFAULT_COACH_URL, coachGatewayUrl, readAiCoachCredential, saveAiCoachCredential, validateAiCoachCredential } from "./aiCoachCredentials";
export { DEFAULT_COACH_URL, coachGatewayUrl } from "./aiCoachCredentials";

export const AI_CONNECTION_KEY = "gym-tracker:ai-connection:v1";
const connectionSchema = z.object({ enabled: z.boolean(), consent: z.boolean(), url: z.string() }).strict();
export type AiConnection = z.infer<typeof connectionSchema>;
let ownerToken = "";
let credentialUrl = "";
let credentialsLoaded = false;
let loadingCredentials: Promise<void> | null = null;
let connectionError: string | null = null;
let generation = 0;
let sequence = 0;
let writes: Promise<unknown> = Promise.resolve();
const controllers = new Set<AbortController>();
const answerGenerations = new WeakMap<object, number>();

const defaultConnection = (): AiConnection => ({ enabled: false, consent: false, url: DEFAULT_COACH_URL });
async function storedConnection() {
  const raw = await AsyncStorage.getItem(AI_CONNECTION_KEY);
  try {
    if (raw) {
      const parsed = connectionSchema.parse(JSON.parse(raw));
      return { ...parsed, url: parsed.url ? coachGatewayUrl(parsed.url) : DEFAULT_COACH_URL };
    }
  } catch { /* Invalid connection metadata never blocks diary recovery. */ }
  return defaultConnection();
}
async function loadCredentials() {
  if (credentialsLoaded) return;
  if (!loadingCredentials) {
    const epoch = generation;
    loadingCredentials = (async () => {
      try {
        const saved = await readAiCoachCredential();
        if (epoch !== generation) return;
        ownerToken = saved?.token ?? "";
        credentialUrl = saved?.url ?? "";
        credentialsLoaded = true;
        connectionError = null;
      } catch {
        if (epoch === generation) connectionError = "Не удалось прочитать защищённое подключение. Повторите попытку или подключите шлюз заново.";
      }
    })().finally(() => { loadingCredentials = null; });
  }
  await loadingCredentials;
}
export async function readAiConnection(): Promise<AiConnection & { connected: boolean; connectionError: string | null }> {
  await writes.catch(() => {});
  await loadCredentials();
  const parsed = await storedConnection();
  const connected = !!ownerToken && credentialUrl === parsed.url;
  return { ...parsed, enabled: parsed.enabled && parsed.consent && connected, connected, connectionError };
}
function enqueueConnection<T>(action: () => Promise<T>) {
  const operation = writes.catch(() => {}).then(action);
  writes = operation;
  return operation;
}
function updateConnection(values: Partial<AiConnection>) {
  return enqueueConnection(async () => {
    await AsyncStorage.setItem(AI_CONNECTION_KEY, JSON.stringify({ ...await storedConnection(), ...values }));
  });
}
export async function readSavedAiCoachToken() {
  return (await readAiConnection()).connected ? ownerToken : "";
}
function invalidateRequests() {
  generation++;
  for (const controller of controllers) controller.abort();
  controllers.clear();
}
export async function disableAiCoach() {
  invalidateRequests();
  await updateConnection({ enabled: false });
}
export async function setAiConsent(consent: boolean) {
  invalidateRequests();
  await updateConnection(consent ? { consent } : { consent, enabled: false });
}
export async function setAiEnabled(enabled: boolean) {
  if (!enabled) return disableAiCoach();
  const current = await readAiConnection();
  if (!current.connected || !current.consent) throw new Error("Сначала подключите личный шлюз и разрешите отправку данных.");
  invalidateRequests();
  await updateConnection({ enabled: true });
}
export async function disconnectAiCoach() {
  invalidateRequests();
  ownerToken = "";
  credentialUrl = "";
  await enqueueConnection(async () => {
    await AsyncStorage.setItem(AI_CONNECTION_KEY, JSON.stringify({ ...await storedConnection(), enabled: false, consent: false }));
    await saveAiCoachCredential(null);
    credentialsLoaded = true;
    connectionError = null;
  });
}
export async function coachFingerprint(context: CoachContext) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(coachContextSchema.parse(context)));
}
async function send(url: string, token: string, body?: unknown) {
  const controller = new AbortController();
  controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch(url, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, redirect: "error", signal: controller.signal });
    const text = await response.text();
    if (text.length > 65536) throw new Error("Ответ шлюза слишком большой.");
    const result = JSON.parse(text) as unknown;
    if (!response.ok) throw new Error(typeof (result as { error?: unknown }).error === "string" ? (result as { error: string }).error.slice(0, 300) : "Личный шлюз недоступен.");
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Запрос отменён или время ожидания истекло.");
    throw error;
  } finally { clearTimeout(timeout); controllers.delete(controller); }
}
const statusSchema = z.object({ ready: z.boolean(), model: z.string(), budget: coachEnvelopeSchema.shape.budget }).strict();
export async function readAiGatewayStatus() {
  const current = await readAiConnection();
  if (!current.connected) throw new Error("Подключите личный шлюз.");
  const epoch = generation;
  const status = statusSchema.parse(await send(`${current.url}/v1/coach/status`, ownerToken));
  if (epoch !== generation) throw new Error("Настройки соединения изменились.");
  return status;
}
export async function connectAiCoach(urlInput: string, token: string) {
  const credential = validateAiCoachCredential({ url: urlInput, token });
  const { url } = credential;
  const current = await readAiConnection();
  if (current.connected && current.url === url && ownerToken === credential.token) return readAiGatewayStatus();
  invalidateRequests();
  const epoch = generation;
  const status = statusSchema.parse(await send(`${url}/v1/coach/status`, credential.token));
  if (epoch !== generation) throw new Error("Подключение отменено.");
  await enqueueConnection(async () => {
    if (epoch !== generation) throw new Error("Подключение отменено.");
    const previous = await readAiCoachCredential().catch(() => null);
    const current = await storedConnection();
    try {
      await saveAiCoachCredential(credential);
      if (epoch !== generation) throw new Error("Подключение отменено.");
      await AsyncStorage.setItem(AI_CONNECTION_KEY, JSON.stringify({ ...current, url, enabled: false, consent: current.url === url && current.consent }));
      if (epoch !== generation) throw new Error("Подключение отменено.");
    } catch {
      ownerToken = ""; credentialUrl = ""; credentialsLoaded = false;
      try {
        await saveAiCoachCredential(previous);
        await AsyncStorage.setItem(AI_CONNECTION_KEY, JSON.stringify(current));
      } catch { /* A mismatched URL/token pair cannot be used after a failed rollback. */ }
      throw new Error("Подключение не сохранено. Проверьте защищённое хранилище и повторите попытку.");
    }
    invalidateRequests();
    ownerToken = credential.token;
    credentialUrl = url;
    credentialsLoaded = true;
    connectionError = null;
  });
  return status;
}
export async function requestAiCoach(rawContext: CoachContext): Promise<CoachEnvelope> {
  const current = await readAiConnection();
  if (!current.enabled || !current.consent || !current.connected) throw new Error("ИИ-тренер выключен или не подключён.");
  const epoch = generation;
  const token = ownerToken;
  const context = coachContextSchema.parse(rawContext);
  const fingerprint = await coachFingerprint(context);
  if (epoch !== generation) throw new Error("Настройки тренера изменились.");
  const body = { context, fingerprint, id: `${fingerprint}:${Date.now()}:${++sequence}` };
  if (JSON.stringify(body).length > 48000) throw new Error("Слишком большой контекст. Сократите историю для анализа.");
  const result = coachEnvelopeSchema.parse(await send(`${current.url}/v1/coach`, token, body));
  const latest = await readAiConnection();
  if (epoch !== generation || !latest.enabled || !latest.consent || ownerToken !== token) throw new Error("Тренер отключён. Ответ не применён.");
  if (result.fingerprint !== fingerprint) throw new Error("Шлюз ответил для другой тренировки.");
  validateCoachReply(result.result, context);
  answerGenerations.set(result, epoch);
  return result;
}
export async function assertCoachAnswerCurrent(answer: CoachEnvelope, latestContext: CoachContext) {
  const settings = await readAiConnection();
  if (!settings.enabled || !settings.consent || !settings.connected || answerGenerations.get(answer) !== generation) throw new Error("Тренер отключён или подключение изменилось.");
  if (await coachFingerprint(latestContext) !== answer.fingerprint) throw new Error("Тренировка или профиль изменились. Запросите новый совет.");
  if (answerGenerations.get(answer) !== generation) throw new Error("Настройки тренера изменились.");
  validateCoachReply(answer.result, latestContext);
}
