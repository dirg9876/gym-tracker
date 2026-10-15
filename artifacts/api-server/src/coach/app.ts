import express from "express";
import { timingSafeEqual } from "node:crypto";
import { SqlCoachLedger, CoachHttpError } from "./ledgerCore.ts";
import { MODEL, type CoachProvider } from "./provider.ts";
import { hash, processCoachRequest } from "./core.ts";
export { hash } from "./core.ts";

export function createCoachGateway({ token, ledger, provider }: { token: string; ledger: SqlCoachLedger; provider: CoachProvider | null }) {
  if (token.length < 32) throw new Error("Owner token must contain at least 32 characters");
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get("/healthz", (_req, res) => { res.json({ status: "ok" }); });
  app.use((req, res, next) => {
    const candidate = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
    if (!timingSafeEqual(Buffer.from(hash(candidate)), Buffer.from(hash(token)))) { res.status(401).json({ error: "Неверный токен личного шлюза." }); return; }
    next();
  });
  app.use(express.json({ limit: "64kb", strict: true }));
  app.get("/v1/coach/status", (_req, res) => { res.json({ ready: !!provider, model: MODEL, budget: ledger.budget() }); });
  app.post("/v1/coach", async (req, res) => {
    try { res.json(await processCoachRequest(req.body, ledger, provider)); }
    catch (error) {
      if (error instanceof CoachHttpError) res.status(error.status).json({ error: error.message });
      else res.status(502).json({ error: "ИИ не вернул проверенный ответ. Данные не изменены; повторный запрос может расходовать бюджет." });
    }
  });
  app.use((_req, res) => { res.status(404).json({ error: "Маршрут не найден." }); });
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (error as { status?: number }).status === 413 ? 413 : 400;
    res.status(status).json({ error: status === 413 ? "Контекст слишком большой." : "Неверный запрос." });
  });
  return app;
}
