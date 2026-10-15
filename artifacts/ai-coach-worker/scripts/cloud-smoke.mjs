import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { validateCoachReply } from "@workspace/ai-coach";
import { reserveCost } from "../../api-server/src/coach/provider.ts";

if (!process.argv.includes("--paid-once")) throw new Error("Explicit --paid-once required; no automatic paid retries");
const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const output = new URL("cloud-smoke-2026-10-15.json", directory);
if (fs.existsSync(output)) throw new Error("Cloud smoke report already exists; do not repeat paid requests");
const { url } = JSON.parse(fs.readFileSync(new URL("cloud-cutover.json", directory), "utf8"));
const token = fs.readFileSync(new URL("owner-token", directory), "utf8").trim();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const evaluation = JSON.parse(fs.readFileSync(new URL("evaluation-replay-2026-10-15.json", directory), "utf8"));
const context = evaluation.steps.find(step => step.context.task === "next_set" && step.context.focus?.draft?.exerciseId === 30)?.context;
assert.ok(context, "Synthetic timed exercise context required");
assert.ok(reserveCost(context) / 1e9 < 0.005, "Smoke reservation ceiling exceeded");
const fingerprint = createHash("sha256").update(JSON.stringify(context)).digest("hex");
const body = JSON.stringify({ id: `cloud-smoke:${randomUUID()}`, fingerprint, context });
const report = { syntheticDataOnly: true, startedAt: new Date().toISOString(), paidRequests: 0, url };
const status = async () => {
  const response = await fetch(`${url}/v1/coach/status`, { headers, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  return response.json();
};
try {
  report.before = await status();
  assert.equal(report.before.ready, true);
  report.paidRequests++;
  const response = await fetch(`${url}/v1/coach`, { method: "POST", headers, body, signal: AbortSignal.timeout(60000) });
  report.httpStatus = response.status;
  report.answer = await response.json();
  assert.equal(response.status, 200, "Cloud inference failed; no automatic retry");
  assert.equal(report.answer.fingerprint, fingerprint);
  const result = validateCoachReply(report.answer.result, context);
  if (result.nextSet) {
    assert.equal(result.nextSet.weightKg, 0);
    assert.equal(result.nextSet.reps, 0);
    assert.ok(result.nextSet.durationSeconds > 0 && result.nextSet.durationSeconds <= 90);
  }
  const cached = await fetch(`${url}/v1/coach`, { method: "POST", headers, body, signal: AbortSignal.timeout(20000) });
  assert.equal(cached.status, 200);
  const replay = await cached.json();
  assert.deepEqual(replay.result, result);
  assert.deepEqual(replay.budget, report.answer.budget);
  report.cacheWithoutAdditionalCost = true;
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = String(error.message).split(token).join("[redacted]").slice(0, 300);
  process.exitCode = 1;
} finally {
  try { report.after = await status(); } catch { /* Status failure never triggers another paid request. */ }
  if (report.after && report.before) report.costUsd = report.after.budget.usedUsd - report.before.budget.usedUsd;
  report.finishedAt = new Date().toISOString();
  const text = JSON.stringify(report, null, 2);
  assert.ok(!text.includes(token));
  fs.writeFileSync(output, text, { mode: 0o600, flag: "wx" });
  console.log(text);
}
