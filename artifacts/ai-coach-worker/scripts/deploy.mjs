import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const state = join(root, ".cloud-deploy");
const apiData = fileURLToPath(new URL("../../api-server/.coach-data/", import.meta.url));
const seedFile = join(state, "seed.json");
const configFile = join(state, "wrangler.json");
const mode = process.argv[2];
if (!["--prepare", "--publish", "--secrets"].includes(mode)) throw new Error("Choose --prepare, --publish or --secrets");
if (mode !== "--prepare" && !process.argv.includes("--free-plan-confirmed")) throw new Error("Confirm Workers Free before publishing");
fs.mkdirSync(state, { recursive: true, mode: 0o700 });

if (!fs.existsSync(seedFile)) {
  let localRunning = false;
  try { localRunning = (await fetch("http://127.0.0.1:8787/healthz", { signal: AbortSignal.timeout(1000) })).ok; } catch { /* An offline local gateway cannot incur concurrent charges. */ }
  if (localRunning) throw new Error("Stop the local paid gateway before freezing the migration budget");
  const database = new DatabaseSync(join(apiData, "budget.sqlite"), { readOnly: true });
  try {
    if (database.prepare("SELECT count(*) AS n FROM requests WHERE status='pending'").get().n) throw new Error("Pending local requests must settle before migration");
    const month = new Date().toISOString().slice(0, 7);
    const totals = database.prepare("SELECT COALESCE(SUM(cost),0) AS used,COALESCE(SUM(CASE WHEN cost IS NULL THEN reserve ELSE 0 END),0) AS reserved FROM requests WHERE month=?").get(month);
    fs.writeFileSync(seedFile, JSON.stringify({ month, usedNanoUsd: totals.used, reservedNanoUsd: totals.reserved }, null, 2), { flag: "wx", mode: 0o600 });
  } finally { database.close(); }
}
const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
const config = JSON.parse(fs.readFileSync(join(root, "wrangler.jsonc"), "utf8"));
config.main = join(root, "src/index.ts");
config.vars.INITIAL_BUDGET_JSON = JSON.stringify(seed);
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
console.log(JSON.stringify({ prepared: true, carriedBudget: seed, worker: config.name }));
if (mode === "--prepare") process.exit(0);

const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("wrangler/package.json")), "bin/wrangler.js");
let secrets;
if (mode === "--secrets") {
  const env = parseEnv(fs.readFileSync(new URL("../../api-server/.env.coach", import.meta.url), "utf8"));
  const apiKey = env.OPENAI_API_KEY?.trim();
  const token = (env.AI_COACH_OWNER_TOKEN ?? fs.readFileSync(join(apiData, "owner-token"), "utf8")).trim();
  if (!apiKey?.startsWith("sk-") || token.length < 32) throw new Error("Private OpenAI key and owner token must be configured");
  secrets = { OPENAI_API_KEY: apiKey, AI_COACH_OWNER_TOKEN: token };
}
const args = mode === "--publish"
  ? [cli, "deploy", "--config", configFile, "--minify", "--strict", "--no-autoconfig"]
  : [cli, "secret", "bulk", "--config", configFile];
const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", input: secrets ? JSON.stringify(secrets) : undefined, timeout: 120000, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
const redact = text => Object.values(secrets ?? {}).reduce((safe, secret) => safe.split(secret).join("[redacted]"), text ?? "");
process.stdout.write(redact(result.stdout));
process.stderr.write(redact(result.stderr));
if (result.error || result.status !== 0) throw new Error("Cloudflare command failed; no automatic retry or paid fallback");
