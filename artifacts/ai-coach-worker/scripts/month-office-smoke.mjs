import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { coachContextSchema, defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
import { reserveCost } from "../../api-server/src/coach/provider.ts";
if (!process.argv.includes("--paid-once")) throw new Error("Explicit paid-once required");
const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const file = new URL("month-office-smoke-2026-10-15.json", directory);
if (fs.existsSync(file)) throw new Error("Already attempted; do not repeat paid requests");
const { url, token } = JSON.parse(fs.readFileSync(new URL("gym-beam-coach-connection.json", directory), "utf8"));
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const catalog = [
  [1, "Жим штанги лёжа", "Грудь", "barbell"], [3, "Жим гантелей лёжа", "Грудь", "dumbbell"],
  [4, "Отжимания на брусьях", "Грудь", "bodyweight"], [6, "Становая тяга", "Спина", "barbell"],
  [7, "Подтягивания", "Спина", "bodyweight"], [9, "Тяга гантели одной рукой", "Спина", "dumbbell"],
  [16, "Приседания со штангой", "Ноги", "barbell"], [18, "Выпады с гантелями", "Ноги", "dumbbell"],
  [30, "Планка", "Пресс", "bodyweight"], [31, "Отжимания", "Грудь", "bodyweight"],
].map(([id, name, muscleGroup, equipment]) => ({ id, name, muscleGroup, equipment, timed: id === 30 }));
const base = { version: 1, task: "month_plan", preferences: defaultCoachProfile(), athlete: { sex: null, bodyWeightKg: null }, catalog,
  sessions: [{ id: 1, finishedAt: "2026-10-12T10:00:00Z", sets: [{ exerciseId: 1, weightKg: 40, reps: 8, durationSeconds: null, rir: 2, technique: "good" }, { exerciseId: 7, weightKg: 0, reps: 4, durationSeconds: null, rir: 2, technique: "good" }] }], focus: null, programs: [], truncated: false };
const office = coachContextSchema.parse({ ...base, task: "next_workout", trainingMode: "office", preferences: { ...base.preferences, sessionMinutes: 20, equipment: ["bodyweight"] }, messages: [{ role: "user", text: "Короткая офисная тренировка с турником, брусьями и отжиманиями. Без дополнительного веса. Подтягиваться могу около четырёх раз." }] });
const month = coachContextSchema.parse({ ...base, messages: [{ role: "user", text: "Составь полноценный план на четыре недели по моей истории и цели общей формы: три раза в неделю, час-полтора, основные группы мышц, разумное восстановление. Не повышай веса автоматически по неделям." }] });
const contexts = [office, month];
assert.ok(contexts.reduce((sum, context) => sum + reserveCost(context), 0) < 20_000_000);
const status = async () => { const response = await fetch(`${url}/v1/coach/status`, { headers, signal: AbortSignal.timeout(20000) }); assert.equal(response.status, 200); return response.json(); };
const report = { syntheticDataOnly: true, startedAt: new Date().toISOString(), paidRequests: 0, results: [], before: await status() };
assert.ok(report.before.ready); assert.ok(report.before.budget.usedUsd + report.before.budget.reservedUsd + 0.02 < 5);
fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
try {
  for (const context of contexts) {
    const fingerprint = createHash("sha256").update(JSON.stringify(context)).digest("hex"); report.paidRequests++;
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    const response = await fetch(`${url}/v1/coach`, { method: "POST", headers, body: JSON.stringify({ id: `month-office:${randomUUID()}`, context, fingerprint }), signal: AbortSignal.timeout(60000) });
    const envelope = await response.json(); const step = { task: context.task, status: response.status, context, envelope }; report.results.push(step);
    assert.equal(response.status, 200, "No automatic paid retry"); assert.equal(envelope.fingerprint, fingerprint);
    const reply = validateCoachReply(envelope.result, context);
    if (context.task === "month_plan") {
      assert.ok(reply.monthly); assert.equal(reply.monthly.weeks.length, 4);
      const groups = new Set(reply.monthly.templates.flatMap(template => template.exercises.map(ex => catalog.find(item => item.id === ex.exerciseId).muscleGroup)));
      assert.ok(groups.size >= 3, "Monthly plan should not neglect most muscle groups");
    } else { assert.ok(reply.plan); assert.ok(reply.plan.exercises.every(ex => [4, 7, 30, 31].includes(ex.exerciseId))); }
    step.passed = true;
  }
  report.passed = true;
} catch (error) { report.error = error instanceof Error ? error.message : "Evaluation failed"; process.exitCode = 1; }
finally {
  report.after = await status().catch(() => null); fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed ?? false, paidRequests: report.paidRequests, results: report.results.map(({ task, status, passed }) => ({ task, status, passed })), before: report.before.budget, after: report.after?.budget, error: report.error }));
}
