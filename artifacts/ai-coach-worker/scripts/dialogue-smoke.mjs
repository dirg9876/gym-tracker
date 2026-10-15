import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { coachContextSchema, defaultCoachProfile, validateCoachReply } from "@workspace/ai-coach";
import { reserveCost } from "../../api-server/src/coach/provider.ts";

if (!process.argv.includes("--paid-once")) throw new Error("Explicit paid-once required");
const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const file = new URL("dialogue-smoke-2026-10-15.json", directory);
if (fs.existsSync(file)) throw new Error("Already attempted; do not repeat paid requests");
const { url, token } = JSON.parse(fs.readFileSync(new URL("gym-beam-coach-connection.json", directory), "utf8"));
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const target = (weightKg, reps = 8) => ({ weightKg, reps, durationSeconds: null });
const observed = { exerciseId: 1, ...target(40), rir: 2, technique: "good" };
const base = {
  version: 1, task: "adjust_workout", preferences: defaultCoachProfile(), athlete: { sex: null, bodyWeightKg: null },
  catalog: [
    { id: 1, name: "Жим штанги лёжа", muscleGroup: "Грудь", equipment: "barbell", timed: false },
    { id: 9, name: "Тяга гантели одной рукой", muscleGroup: "Спина", equipment: "dumbbell", timed: false },
    { id: 10, name: "Тяга вертикального блока", muscleGroup: "Спина", equipment: "machine", timed: false },
    { id: 16, name: "Приседания со штангой", muscleGroup: "Ноги", equipment: "barbell", timed: false },
    { id: 18, name: "Выпады с гантелями", muscleGroup: "Ноги", equipment: "dumbbell", timed: false },
    { id: 30, name: "Планка", muscleGroup: "Пресс", equipment: "bodyweight", timed: true },
  ],
  sessions: [{ id: 1, finishedAt: null, sets: [observed] }],
  focus: { workoutId: 1, finished: false, draftRevision: 1, performedSetCount: 1, draft: { exerciseId: 10, ...target(30), rir: null, technique: null } },
  remainingPlan: [{ exerciseId: 1, targets: [target(40), target(40)] }, { exerciseId: 10, targets: [target(30), target(30)] }, { exerciseId: 30, targets: [{ weightKg: 0, reps: 0, durationSeconds: 30 }] }],
  programs: [], truncated: false,
};
const scenarios = [
  { name: "busy-machine", message: "Тренажёр тяги вертикального блока занят. Замени только это упражнение, остальные оставшиеся упражнения и подходы сохрани.", check: reply => {
    assert.ok(reply.plan, "Replacement plan expected");
    const ids = reply.plan.exercises.map(ex => ex.exerciseId);
    assert.ok(!ids.includes(10)); assert.ok(ids.includes(9)); assert.ok(ids.includes(1)); assert.ok(ids.includes(30));
    assert.deepEqual(reply.plan.exercises.find(ex => ex.exerciseId === 1).targets, base.remainingPlan[0].targets);
    assert.deepEqual(reply.plan.exercises.find(ex => ex.exerciseId === 30).targets, base.remainingPlan[2].targets);
  } },
  { name: "different-muscles", message: "Сегодня вместо оставшейся тренировки хочу только ноги: приседания и выпады, без жимов и тяг. Уже выполненный жим не изменяй.", check: reply => {
    assert.ok(reply.plan, "Leg-focused plan expected");
    assert.ok(reply.plan.exercises.every(ex => [16, 18].includes(ex.exerciseId)));
    assert.ok(reply.plan.exercises.every(ex => ex.targets.every(set => set.weightKg === null)));
  } },
];
const contexts = scenarios.map(scenario => coachContextSchema.parse({ ...base, messages: [{ role: "user", text: scenario.message }] }));
assert.ok(contexts.reduce((sum, ctx) => sum + reserveCost(ctx), 0) < 20_000_000, "Reservation ceiling exceeds $0.02");
const status = async () => {
  const response = await fetch(`${url}/v1/coach/status`, { headers, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); return response.json();
};
const report = { syntheticDataOnly: true, startedAt: new Date().toISOString(), paidRequests: 0, results: [] };
report.before = await status();
assert.ok(report.before.ready);
assert.ok(report.before.budget.usedUsd + report.before.budget.reservedUsd + 0.02 < report.before.budget.limitUsd);
fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
try {
  for (let i = 0; i < scenarios.length; i++) {
    const context = contexts[i]; const fingerprint = createHash("sha256").update(JSON.stringify(context)).digest("hex");
    report.paidRequests++; fs.writeFileSync(file, JSON.stringify(report, null, 2));
    const response = await fetch(`${url}/v1/coach`, { method: "POST", headers, body: JSON.stringify({ id: `dialogue:${randomUUID()}`, context, fingerprint }), signal: AbortSignal.timeout(60000) });
    const envelope = await response.json(); report.results.push({ name: scenarios[i].name, status: response.status, context, envelope });
    assert.equal(response.status, 200, "No automatic retry on failure");
    assert.equal(envelope.fingerprint, fingerprint);
    scenarios[i].check(validateCoachReply(envelope.result, context));
    report.results.at(-1).passed = true;
  }
  report.passed = true;
} catch (error) { report.error = error instanceof Error ? error.message : "Evaluation failed"; process.exitCode = 1; }
finally {
  report.after = await status().catch(() => null);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed ?? false, paidRequests: report.paidRequests, scenarios: report.results.map(({ name, status, passed }) => ({ name, status, passed })), before: report.before.budget, after: report.after?.budget, error: report.error }));
}
