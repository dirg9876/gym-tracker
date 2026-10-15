import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { hash, processCoachRequest } from "../../api-server/src/coach/core.ts";
import { SqlCoachLedger, CoachHttpError, type LedgerDatabase } from "../../api-server/src/coach/ledgerCore.ts";
import { MODEL, openAiProvider } from "../../api-server/src/coach/provider.ts";

type Env = {
  COACH: DurableObjectNamespace;
  AI_COACH_OWNER_TOKEN?: string;
  OPENAI_API_KEY?: string;
  AI_COACH_MONTHLY_LIMIT_USD?: string;
  INITIAL_BUDGET_JSON?: string;
};
const initialSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), usedNanoUsd: z.number().int().nonnegative().safe(), reservedNanoUsd: z.number().int().nonnegative().safe() }).strict();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const authorized = (request: Request, env: Env) => {
  const token = env.AI_COACH_OWNER_TOKEN?.trim();
  if (!token || token.length < 32) return false;
  const header = request.headers.get("Authorization") ?? "";
  const candidate = header.startsWith("Bearer ") ? header.slice(7) : "";
  return timingSafeEqual(Buffer.from(hash(candidate)), Buffer.from(hash(token)));
};
function parseInitial(value?: string) {
  try { return initialSchema.safeParse(JSON.parse(value ?? "null")); }
  catch { return initialSchema.safeParse(null); }
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new CoachHttpError(400, "Неверный запрос.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) { await reader.cancel(); throw new CoachHttpError(413, "Контекст слишком большой."); }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(data)); }
  catch { throw new CoachHttpError(400, "Неверный запрос."); }
}

export class CoachObject {
  private ledger: SqlCoachLedger;
  constructor(ctx: DurableObjectState, private env: Env) {
    const backend: LedgerDatabase = {
      exec: sql => { ctx.storage.sql.exec(sql).toArray(); },
      prepare: sql => ({
        get: (...bindings) => ctx.storage.sql.exec(sql, ...bindings).toArray()[0],
        run: (...bindings) => ctx.storage.sql.exec(sql, ...bindings).toArray(),
      }),
      transaction: action => ctx.storage.transactionSync(action),
    };
    this.ledger = new SqlCoachLedger(backend, Math.round(Number(env.AI_COACH_MONTHLY_LIMIT_USD ?? "5") * 1e9));
    const parsed = parseInitial(env.INITIAL_BUDGET_JSON);
    if (!parsed.success) throw new Error("Budget migration must be configured before inference");
    const seed = parsed.data;
    const canonical = JSON.stringify(seed);
    backend.transaction(() => {
      backend.exec("CREATE TABLE IF NOT EXISTS migration (id INTEGER PRIMARY KEY,value TEXT NOT NULL)");
      const existing = backend.prepare("SELECT value FROM migration WHERE id=1").get();
      if (existing) { if (existing.value !== canonical) throw new Error("Budget migration is immutable"); return; }
      backend.prepare("INSERT INTO migration(id,value) VALUES(1,?)").run(canonical);
      backend.prepare("INSERT INTO requests(id,fingerprint,month,created,status,reserve,cost) VALUES(?,?,?,?,?,?,?)").run("carried-local-used", "migration", seed.month, 0, "failed", 0, seed.usedNanoUsd);
      if (seed.reservedNanoUsd) backend.prepare("INSERT INTO requests(id,fingerprint,month,created,status,reserve) VALUES(?,?,?,?,?,?)").run("carried-local-reserved", "migration", seed.month, 0, "failed", seed.reservedNanoUsd);
    });
    this.ledger.recoverInterrupted();
  }
  async fetch(request: Request) {
    if (!authorized(request, this.env)) return json({ error: "Неверный токен личного шлюза." }, 401);
    const path = new URL(request.url).pathname;
    try {
      if (request.method === "GET" && path === "/v1/coach/status") return json({ ready: !!this.env.OPENAI_API_KEY?.trim(), model: MODEL, budget: this.ledger.budget() });
      if (request.method !== "POST" || path !== "/v1/coach") return json({ error: "Маршрут не найден." }, 404);
      const body = await readBody(request);
      return json(await processCoachRequest(body, this.ledger, this.env.OPENAI_API_KEY?.trim() ? openAiProvider(this.env.OPENAI_API_KEY.trim()) : null));
    } catch (error) {
      return json({ error: error instanceof CoachHttpError ? error.message : "Шлюз недоступен. Повторный запрос может расходовать бюджет." }, error instanceof CoachHttpError ? error.status : 503);
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "GET" && new URL(request.url).pathname === "/healthz") return json({ status: "ok" });
    if (!authorized(request, env)) return json({ error: "Неверный токен личного шлюза." }, 401);
    if (!parseInitial(env.INITIAL_BUDGET_JSON).success) return json({ error: "Перенос бюджета ещё не настроен. Платных запросов нет." }, 503);
    try { return await env.COACH.get(env.COACH.idFromName("owner-v1")).fetch(request); }
    catch { return json({ error: "Облачный шлюз временно недоступен. Дневник продолжает работать." }, 503); }
  },
};
