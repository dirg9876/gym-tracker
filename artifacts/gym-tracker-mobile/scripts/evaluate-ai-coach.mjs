import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";

const replay = process.argv.includes("--replay");
if (!replay && !process.argv.includes("--paid")) {
  console.log("Explicit evaluation: --paid for four live requests, or --replay for the saved replies without network.");
  process.exit(0);
}
assert.ok(!(replay && process.argv.includes("--paid")), "Choose paid or replay, never both");

const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const source = replay ? JSON.parse(fs.readFileSync(new URL("evaluation-2026-10-15.json", directory), "utf8")) : null;
const output = new URL(replay ? "evaluation-replay-2026-10-15.json" : "evaluation-2026-10-15.json", directory);
if (fs.existsSync(output)) throw new Error("Evaluation report already exists. Do not automatically repeat paid requests.");
const token = replay ? "offline-replay-not-a-credential-1234567890" : fs.readFileSync(new URL("owner-token", directory), "utf8").trim();
const { reserveCost } = await import("../../api-server/src/coach/provider.ts");
const connection = await import("../lib/aiCoachConnection.ts");
const { exportProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const { setCoachProposal } = await import("../lib/aiCoachPlan.ts");
const { makeWorkoutDraft } = await import("../lib/workoutDraft.ts");
const network = globalThis.fetch;
const report = { mode: replay ? "offline-replay" : "paid", syntheticDataOnly: true, startedAt: new Date().toISOString(), steps: [], checks: [], requests: 0, reservationCeilingUsd: 0.02 };
let reserved = 0;
const withoutDates = value => ({ ...value, sessions: value.sessions.map(session => ({ ...session, finishedAt: session.finishedAt == null ? null : "recorded-date" })) });

globalThis.fetch = async (url, options) => {
  if (options?.method === "POST") {
    assert.ok(String(url).startsWith("http://127.0.0.1:8787/v1/coach"));
    const { context } = JSON.parse(options.body);
    reserved += reserveCost(context) / 1e9;
    assert.ok(reserved <= report.reservationCeilingUsd, "Evaluation reservation ceiling exceeded");
    assert.ok(report.requests < 4, "No automatic retries or extra paid requests");
    const index = report.requests++;
    if (replay) {
      const captured = source.steps[index];
      assert.deepEqual(withoutDates(context), withoutDates(captured.context), "Replay input differs from the real evaluated observations");
      return new Response(JSON.stringify({ ...captured.answer, fingerprint: JSON.parse(options.body).fingerprint, budget: source.budgetAfter }));
    }
  }
  if (replay) return new Response(JSON.stringify({ ready: true, model: "gpt-6-luna", budget: source.budgetAfter }));
  return network(url, options);
};

const context = (task, workoutId) => request("/api/ai-coach/context", "POST", { task, workoutId });
async function advise(name, task, workoutId) {
  const snapshot = await context(task, workoutId);
  const started = Date.now();
  const answer = await connection.requestAiCoach(snapshot);
  await connection.assertCoachAnswerCurrent(answer, await context(task, workoutId));
  report.steps.push({ name, elapsedMs: Date.now() - started, context: snapshot, answer });
  return { answer, snapshot };
}
async function check(name, action) {
  await action();
  report.checks.push(name);
}

try {
  assert.equal(storage.size, 0);
  const status = await connection.connectAiCoach("http://127.0.0.1:8787", token);
  assert.equal(status.ready, true);
  report.budgetBefore = status.budget;
  const workout = await request("/api/workouts", "POST", { name: "Synthetic AI evaluation" });
  for (const values of [{ reps: 10, rir: 3, technique: "good" }, { reps: 8, rir: 2, technique: "good" }, { reps: 6, rir: 0, technique: "breakdown" }]) {
    await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, ...values });
  }
  await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45 });
  await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 40, reps: 6 } });
  await check("disabled coach makes no inference request", async () => {
    await assert.rejects(connection.requestAiCoach(await context("next_set", workout.id)));
    assert.equal(report.requests, 0);
  });
  await connection.setAiConsent(true);
  await connection.setAiEnabled(true);

  const bench = await advise("fatigue: 40 kg, reps 10 -> 8 -> 6, RIR0, breakdown", "next_set", workout.id);
  await check("fatigue cannot increase load; confirmation changes only draft", async () => {
    const target = bench.answer.result.nextSet;
    if (!target) { report.checks.push("model declined another set; no automatic modification"); return; }
    assert.ok(target.weightKg <= 40);
    const before = JSON.parse(await exportProgress()).state.sets.length;
    await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: bench.snapshot.focus.draftRevision, coachFingerprint: bench.answer.fingerprint, draft: { exerciseId: target.exerciseId, weightKg: target.weightKg, reps: target.reps, rir: null, technique: null } });
    assert.equal(JSON.parse(await exportProgress()).state.sets.length, before);
    await assert.rejects(connection.assertCoachAnswerCurrent(bench.answer, await context("next_set", workout.id)));
  });

  const current = await request(`/api/workouts/${workout.id}/draft`);
  await request(`/api/workouts/${workout.id}/draft`, "PUT", { revision: current.revision, draft: { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45 } });
  const plank = await advise("plank: seconds, never kilograms", "next_set", workout.id);
  await check("timed recommendation has no weight or repetitions", async () => {
    const target = plank.answer.result.nextSet;
    if (!target) return;
    assert.equal(target.weightKg, 0); assert.equal(target.reps, 0);
    assert.ok(target.durationSeconds > 0 && target.durationSeconds <= 90);
  });

  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const review = await advise("review of synthetic completed workout", "review", workout.id);
  assert.equal(review.answer.result.nextSet, null); assert.equal(review.answer.result.plan, null);
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), sessionMinutes: 30, equipment: ["barbell", "dumbbell", "bodyweight"], excludedExerciseIds: [1] });
  const next = await advise("next workout: 30 min, excluded bench, limited equipment", "next_workout");
  assert.ok(next.answer.result.plan, "Model did not propose a workout");
  await check("plan respects exclusions, equipment and time; new loads need calibration", async () => {
    const rows = next.answer.result.plan.exercises;
    assert.ok(rows.every(row => row.exerciseId !== 1));
    assert.ok(rows.reduce((sum, row) => sum + row.targets.length, 0) <= 15);
    const before = JSON.parse(await exportProgress()).state;
    const proposal = setCoachProposal(next.answer.result, next.snapshot);
    assert.equal(JSON.parse(await exportProgress()).state.customPrograms.length, 0);
    const needsCalibration = proposal.exercises.some(ex => ex.setTargets.some(target => !Number.isFinite(target.weightKg)));
    if (needsCalibration) await assert.rejects(request("/api/programs", "POST", proposal));
    const calibrated = proposal.exercises.map(ex => ({ ...ex, setTargets: ex.setTargets.map(target => ({ ...target, weightKg: Number.isFinite(target.weightKg) ? target.weightKg : ex.equipment === "barbell" ? 20 : 5 })) }));
    const saved = await request("/api/programs", "POST", { name: proposal.name, description: proposal.description, exercises: calibrated });
    const roundTrip = await parseProgressBackup(await exportProgress());
    assert.equal(roundTrip.version, 10); assert.equal(roundTrip.state.customPrograms.length, 1);
    assert.deepEqual(roundTrip.state.sets, before.sets);
    const repeated = await request("/api/workouts", "POST", { programId: saved.id });
    let draft = await request(`/api/workouts/${repeated.id}/draft`);
    if (!draft.draft) {
      // The React screen initializes this draft; the headless test must do the same.
      const first = calibrated[0];
      const exercise = next.snapshot.catalog.find(row => row.id === first.exerciseId);
      await request(`/api/workouts/${repeated.id}/draft`, "PUT", { revision: draft.revision, draft: makeWorkoutDraft(exercise, first.setTargets[0]) });
      draft = await request(`/api/workouts/${repeated.id}/draft`);
    }
    assert.ok(draft.draft);
    const edited = { ...draft.draft, ...(draft.draft.durationSeconds == null ? { reps: draft.draft.reps + 1 } : { durationSeconds: draft.draft.durationSeconds + 5 }) };
    await request(`/api/workouts/${repeated.id}/draft`, "PUT", { revision: draft.revision, draft: edited });
    assert.deepEqual((await request(`/api/workouts/${repeated.id}/draft`)).draft, edited);
    assert.equal(JSON.parse(await exportProgress()).state.sets.length, before.sets.length);
    report.calibrationRequired = needsCalibration;
  });
  await connection.disableAiCoach();
  await check("off blocks requests and old answer application", async () => {
    await assert.rejects(connection.requestAiCoach(next.snapshot));
    await assert.rejects(connection.assertCoachAnswerCurrent(next.answer, next.snapshot));
    assert.equal(report.requests, 4);
  });
  report.result = "passed";
} catch (error) {
  report.result = "failed";
  report.error = (error instanceof Error ? error.message : "Evaluation failed").split(token).join("[redacted]").slice(0, 500);
  process.exitCode = 1;
} finally {
  try { report.budgetAfter = (await connection.readAiGatewayStatus()).budget; } catch { /* A failed status check does not justify retrying inference. */ }
  if (report.budgetAfter && report.budgetBefore) report.costUsd = report.budgetAfter.usedUsd - report.budgetBefore.usedUsd;
  report.reservedCeilingUsedUsd = reserved;
  report.paidRequests = replay ? 0 : report.requests;
  report.finishedAt = new Date().toISOString();
  await connection.disconnectAiCoach();
  globalThis.fetch = network;
  const text = JSON.stringify(report, null, 2);
  assert.ok(!text.includes(token));
  fs.writeFileSync(output, text, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ result: report.result, error: report.error, requests: report.requests, checks: report.checks, costUsd: report.costUsd, budgetAfter: report.budgetAfter, report: fileURLToPath(output), replies: report.steps.map(step => ({ name: step.name, result: step.answer.result })) }, null, 2));
}
