import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { coachContextSchema, defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
import { reserveCost } from "../../api-server/src/coach/provider.ts";
if (!process.argv.includes("--paid-once")) throw new Error("Explicit paid-once required");
const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const file = new URL("calibration-hypertrophy-smoke-2026-10-16.json", directory);
if (fs.existsSync(file)) throw new Error("Already attempted; no automatic paid retry");
const { url, token } = JSON.parse(fs.readFileSync(new URL("gym-beam-coach-connection.json", directory), "utf8"));
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const catalog = [[1, "Жим штанги лёжа", "Грудь", "barbell"], [3, "Жим гантелей лёжа", "Грудь", "dumbbell"], [9, "Тяга гантели одной рукой", "Спина", "dumbbell"], [16, "Приседания со штангой", "Ноги", "barbell"], [18, "Выпады с гантелями", "Ноги", "dumbbell"], [30, "Планка", "Пресс", "bodyweight"]].map(([id, name, muscleGroup, equipment]) => ({ id, name, muscleGroup, equipment, timed: id === 30 }));
const context = coachContextSchema.parse({ version: 1, task: "next_workout", loadSelection: "calibration-v1", preferences: { ...defaultCoachProfile(), goal: "hypertrophy" }, athlete: { sex: null, bodyWeightKg: null }, catalog, sessions: [], focus: null, programs: [], truncated: false, messages: [{ role: "user", text: "Цель — рост мышц. Истории весов пока нет. Составь умеренную тренировку груди, спины и ног с конкретными стартовыми весами и подборочным первым подходом, без отказа." }] });
assert.ok(reserveCost(context) < 10_000_000);
const status = async () => { const response = await fetch(`${url}/v1/coach/status`, { headers, signal: AbortSignal.timeout(20000) }); assert.equal(response.status, 200); return response.json(); };
const report = { syntheticDataOnly: true, startedAt: new Date().toISOString(), paidRequests: 0, before: await status() };
assert.ok(report.before.ready && report.before.budget.usedUsd + report.before.budget.reservedUsd + 0.01 < 5);
fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
try {
  const fingerprint = createHash("sha256").update(JSON.stringify(context)).digest("hex");
  report.paidRequests = 1; fs.writeFileSync(file, JSON.stringify(report, null, 2));
  const response = await fetch(`${url}/v1/coach`, { method: "POST", headers, body: JSON.stringify({ id: `calibration:${randomUUID()}`, context, fingerprint }), signal: AbortSignal.timeout(60000) });
  report.status = response.status; report.envelope = await response.json(); report.context = context;
  assert.equal(response.status, 200, "No automatic paid retry");
  const reply = validateCoachReply(report.envelope.result, context);
  assert.ok(reply.plan && reply.plan.exercises.every(ex => ex.targets.every(set => Number.isFinite(set.weightKg))));
  assert.ok(new Set(reply.plan.exercises.map(ex => catalog.find(item => item.id === ex.exerciseId).muscleGroup)).size >= 3);
  report.passed = true;
} catch (error) { report.error = error instanceof Error ? error.message : "Evaluation failed"; process.exitCode = 1; }
finally {
  report.after = await status().catch(() => null); fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed ?? false, paidRequests: report.paidRequests, status: report.status, before: report.before.budget, after: report.after?.budget, error: report.error }));
}
