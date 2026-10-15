import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createCoachGateway } from "./app.ts";
import { CoachLedger } from "./ledger.ts";
import { openAiProvider } from "./provider.ts";

const directory = resolve(process.env.AI_COACH_DATA_DIR ?? ".coach-data");
mkdirSync(directory, { recursive: true, mode: 0o700 });
if (existsSync(resolve(directory, "cloud-cutover.json"))) throw new Error("Cloud coach is active. Do not start a second independent paid ledger; use the HTTPS gateway recorded in cloud-cutover.json.");
const tokenPath = resolve(directory, "owner-token");
if (!existsSync(tokenPath)) writeFileSync(tokenPath, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
const token = process.env.AI_COACH_OWNER_TOKEN ?? readFileSync(tokenPath, "utf8").trim();
const limit = Number(process.env.AI_COACH_MONTHLY_LIMIT_USD ?? "5");
const port = Number(process.env.AI_COACH_PORT ?? "8787");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid AI_COACH_PORT");
const ledger = new CoachLedger(resolve(directory, "budget.sqlite"), Math.round(limit * 1e9));
ledger.recoverInterrupted();
const apiKey = process.env.OPENAI_API_KEY?.trim();
const app = createCoachGateway({ token, ledger, provider: apiKey ? openAiProvider(apiKey) : null });
const server = app.listen(port, process.env.AI_COACH_HOST ?? "127.0.0.1", () => {
  console.log(`Gym-Beam coach gateway: port ${port}; provider ${apiKey ? "configured" : "not configured"}; owner token file ${tokenPath}`);
});
const shutdown = () => server.close(() => { ledger.close(); process.exit(0); });
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
