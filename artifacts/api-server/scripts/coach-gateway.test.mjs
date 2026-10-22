import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultCoachProfile, coachContextSchema, trainingAnalysisSchema } from "@workspace/ai-coach";
import { CoachLedger } from "../src/coach/ledger.ts";
import { createCoachGateway, hash } from "../src/coach/app.ts";
import { reserveCost, coachBody, openAiProvider } from "../src/coach/provider.ts";

const token = "test-private-owner-token-12345678901234567890";
const ctx = () => coachContextSchema.parse({ version: 1, task: "review", preferences: defaultCoachProfile(), athlete: { sex: null, bodyWeightKg: null }, catalog: [], sessions: [], focus: { workoutId: 1, finished: true, draftRevision: 0, draft: null }, programs: [], truncated: false });
const reply = { summary: "Test provider, not live AI", cautions: [], nextSet: null, plan: null };
test("local paid entry cannot start after cloud cutover", () => {
  const directory = mkdtempSync(join(tmpdir(), "gymbeam-cutover-test-"));
  try {
    writeFileSync(join(directory, "cloud-cutover.json"), '{"url":"https://example.invalid"}');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../src/coach/index.ts", import.meta.url))], { env: { ...process.env, AI_COACH_DATA_DIR: directory, OPENAI_API_KEY: "", AI_COACH_PORT: "8799" }, encoding: "utf8", timeout: 3000 });
    assert.notEqual(result.status, 0); assert.ok(result.stderr.includes("Cloud coach is active"));
    assert.ok(!existsSync(join(directory, "budget.sqlite")));
  } finally {
    assert.ok(directory.startsWith(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  }
});
async function gateway(run, provider, limit = 5_000_000_000) {
  const ledger = new CoachLedger(":memory:", limit);
  const app = createCoachGateway({ token, ledger, provider });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const call = (id, context = ctx(), authorization = `Bearer ${token}`) => fetch(`${url}/v1/coach`, { method: "POST", headers: { authorization, "Content-Type": "application/json" }, body: JSON.stringify({ id, context, fingerprint: hash(JSON.stringify(context)) }) });
  try { await run({ ledger, call, url }); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); ledger.close(); }
}
const output = () => ({ text: JSON.stringify(reply), inputTokens: 1000, outputTokens: 100, completed: true });

test("daily and monthly proposals preserve prepared workouts and normalize provider weights to local calibration", async () => {
  const context = ctx(); context.task = "next_workout"; context.focus = null; context.loadSelection = "calibration-v1";
  context.catalog = [{ id: 1, name: "Bench", muscleGroup: "Chest", equipment: "barbell", timed: false }, { id: 3, name: "DB bench", muscleGroup: "Chest", equipment: "dumbbell", timed: false }];
  const plan = { name: "Prepared", description: "App computes the numbers", exercises: [{ exerciseId: 3, reason: "Calibration", targets: [{ weightKg: 17.5, reps: 8, durationSeconds: null }] }] };
  context.preparedWorkout = plan;
  context.calibrationEstimates = [{ exerciseId: 3, sourceExerciseId: 1, coefficient: 0.3, weightKg: 17.5, reps: 8, reason: "Conservative heuristic, assess first set" }];
  context.loadTargets = [{ exerciseId: 3, targets: plan.exercises[0].targets, calibration: true, reason: "Local model" }];
  await gateway(async ({ call }) => {
    for (const id of ["prepared-gateway-0001", "prepared-gateway-0002"]) {
      const response = await call(id, coachContextSchema.parse(context)); assert.equal(response.status, 200);
      assert.equal((await response.json()).result.plan.exercises[0].targets[0].weightKg, 17.5);
    }
  }, async received => {
    assert.deepEqual(received.preparedWorkout, plan);
    assert.ok(coachBody(received).instructions.includes("preparedWorkout"));
    return { ...output(), text: JSON.stringify({ ...reply, plan: { ...plan, exercises: [{ ...plan.exercises[0], targets: [{ weightKg: 2.5, reps: 12, durationSeconds: null }] }] } }) };
  });
});

test("the gateway returns and caches local math targets instead of provider-invented loads", async () => {
  const context = ctx(); context.task = "next_set"; context.focus.finished = false;
  context.catalog = [{ id: 1, name: "Bench", muscleGroup: "Chest", equipment: "barbell", timed: false, weightStepKg: 2.5 }];
  context.focus.draft = { exerciseId: 1, weightKg: 70, reps: 8, durationSeconds: null, rir: 2, technique: "good" };
  context.sessions = [{ id: 1, finishedAt: null, sets: [context.focus.draft] }];
  context.nextSetTarget = { exerciseId: 1, weightKg: 70, reps: 8, action: "hold", reason: "Local mathematical controller", model: { version: "epley-rir-ema-v1", status: "ready", estimated1RMKg: 93.333, sessions: 0, targetRir: 2, source: "today", validationSamples: 0, repErrorMAE: null, rirErrorMAE: null, fatigueBeta: null, fatigueSamples: 0, unroundedWeightKg: 70, predictedReps: 8, targets: [{ weightKg: 70, reps: 8 }], note: "Estimate, not a lifted record" } };
  const canonical = coachContextSchema.parse(context);
  let calls = 0;
  await gateway(async ({ call }) => {
    assert.ok(coachBody(context).instructions.includes("mathematical model owns numeric"));
    for (const id of ["math-gateway-00001", "math-gateway-00002"]) {
      const response = await call(id, canonical); assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.result.nextSet.weightKg, 70); assert.equal(result.result.nextSet.reps, 8);
    }
    assert.equal(calls, 1);
  }, async () => { calls++; return { ...output(), text: JSON.stringify({ ...reply, nextSet: { exerciseId: 1, weightKg: 500, reps: 30, durationSeconds: null, reason: "Wrong proposed numbers" } }) }; });
});

const analysis = () => trainingAnalysisSchema.parse({ version: 1, asOf: "2026-10-21", from: "2026-09-24",
  totals: { workouts: 1, sets: 0, reps: 0, seconds: 0, repSets: 0, rirKnown: 0, techniqueKnown: 0, failureSets: 0, breakdownSets: 0, rirBuckets: [0, 0, 0, 0, 0, 0, 0] },
  focus: { workoutId: 1, totals: { workouts: 1, sets: 0, reps: 0, seconds: 0, repSets: 0, rirKnown: 0, techniqueKnown: 0, failureSets: 0, breakdownSets: 0, rirBuckets: [0, 0, 0, 0, 0, 0, 0] } },
  groups: [], exercises: [], omittedExercises: 0, limitations: ["No data"] });
const structured = () => ({ ...reply, review: { overview: "No completed sets", progress: [], workload: "No logged volume", effort: "No feedback", priorities: [{ title: "Record", action: "Log completed sets", reason: "Insufficient history" }], limitations: ["Recovery unknown"] } });

test("structured reviews select a dedicated strict schema, use bounded output and preserve the legacy contract", async () => {
  const context = ctx(); context.analysis = analysis();
  const body = coachBody(context);
  assert.equal(body.text.format.name, "gymbeam_review");
  assert.equal(body.max_output_tokens, 4800);
  assert.ok(body.text.format.schema.required.includes("review"));
  assert.ok(body.instructions.includes("two full comparable sessions"));
  assert.ok(body.instructions.includes("hold means repeat the target, not add reps"));
  assert.equal(coachBody(ctx()).text.format.name, "gymbeam_coach");
  let calls = 0;
  await gateway(async ({ call, ledger }) => {
    for (const id of ["structured-review-0001", "structured-review-0002"]) {
      const response = await call(id, context); assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).result, structured());
    }
    assert.equal(calls, 1); assert.equal(ledger.budget().usedUsd, 0.00015);
  }, async () => { calls++; return { ...output(), text: JSON.stringify(structured()) }; });
});

test("invalid structured evidence is charged but never returned or cached as a valid answer", async () => {
  const context = ctx(); context.analysis = analysis();
  const bad = structured(); bad.review.progress = [{ exerciseKey: "invented", observation: "Fake", interpretation: "Fake", action: "Fake" }];
  await gateway(async ({ call, ledger }) => {
    assert.equal((await call("structured-invalid-01", context)).status, 502);
    assert.equal(ledger.budget().usedUsd, 0.00015); assert.equal(ledger.budget().reservedUsd, 0);
  }, async () => ({ ...output(), text: JSON.stringify(bad) }));
});
test("dialogue is fingerprinted, bounded and cached without conflating different messages", async () => {
  let calls = 0;
  const context = ctx(); context.task = "adjust_workout"; context.focus.finished = false;
  context.messages = [{ role: "user", text: "Тренажёр занят" }]; context.remainingPlan = [];
  await gateway(async ({ call }) => {
    assert.equal((await call("dialogue-request-001", context)).status, 200);
    assert.equal((await call("dialogue-request-002", context)).status, 200);
    assert.equal(calls, 1);
    const other = structuredClone(context); other.messages[0].text = "Сегодня спина";
    assert.equal((await call("dialogue-request-003", other)).status, 200);
    assert.equal(calls, 2);
    other.messages[0].role = "system";
    assert.equal((await call("dialogue-request-004", other)).status, 400);
    assert.equal(calls, 2);
  }, async received => { calls++; assert.equal(received.task, "adjust_workout"); return output(); });
});
test("research grounding and remaining-work instructions are sent without enabling web tools", () => {
  const body = coachBody(ctx()); const input = JSON.parse(body.input);
  assert.equal(input.research.version, "acsm-2026-iusca-2021-v2");
  assert.equal(input.research.url, "https://pubmed.ncbi.nlm.nih.gov/41843416/");
  assert.equal(input.research.sources[1].url, "https://doi.org/10.47206/ijsc.v1i1.81");
  assert.match(body.instructions, /8-12 reps for compound exercises and 10-15 for isolation/);
  assert.ok(input.research.principles.some(text => text.includes("not a biological ceiling")));
  assert.ok(body.instructions.includes("ONLY the remaining work"));
  assert.ok(body.instructions.includes("With pain"));
  assert.equal(body.tools, undefined);
});

test("hypertrophy goal and calibration contract reach provider and numeric normalized weights reach client/cache", async () => {
  const context = ctx(); context.task = "next_workout"; context.focus = null;
  context.loadSelection = "calibration-v1"; context.preferences.goal = "hypertrophy";
  context.catalog = [{ id: 3, name: "DB press", muscleGroup: "Chest", equipment: "dumbbell", timed: false }];
  const body = coachBody(context);
  assert.equal(JSON.parse(body.input).context.preferences.goal, "hypertrophy");
  assert.ok(body.instructions.includes("hypertrophy means muscle growth"));
  assert.ok(body.instructions.includes("EVERY proposed set needs a numeric weightKg"));
  await gateway(async ({ call }) => {
    for (const id of ["calibration-api-0001", "calibration-api-0002"]) {
      const response = await call(id, context);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).result.plan.exercises[0].targets[0].weightKg, 2.5);
    }
  }, async () => ({ ...output(), text: JSON.stringify({ ...reply, plan: { name: "Calibration", description: "", exercises: [{ exerciseId: 3, reason: "No load history", targets: [{ weightKg: null, reps: 8, durationSeconds: null }] }] } }) }));
});
test("unauthorized and unconfigured gateways cannot make paid calls", async () => {
  let calls = 0;
  await gateway(async ({ call }) => { assert.equal((await call("request-id-0000001", ctx(), "Bearer wrong")).status, 401); assert.equal(calls, 0); }, async () => { calls++; return output(); });
  await gateway(async ({ call, ledger }) => { assert.equal((await call("request-id-0000001")).status, 503); assert.equal(ledger.budget().reservedUsd, 0); }, null);
});
test("validated replies are cached, actual usage is settled, and IDs cannot change context", async () => {
  let calls = 0;
  await gateway(async ({ call, ledger }) => {
    assert.equal((await call("request-id-0000001")).status, 200);
    assert.equal((await call("request-id-0000002")).status, 200);
    assert.equal(calls, 1);
    assert.equal(ledger.budget().usedUsd, 0.00015);
    assert.equal(ledger.budget().reservedUsd, 0);
    const other = ctx(); other.preferences.daysPerWeek = 4;
    assert.equal((await call("request-id-0000001", other)).status, 409);
  }, async () => { calls++; return output(); });
});
test("an identical pending request is deduplicated before invoking the provider", async () => {
  let resolve;
  let began;
  const started = new Promise(r => { began = r; });
  let calls = 0;
  await gateway(async ({ call }) => {
    const first = call("request-id-0000001"); await started;
    assert.equal((await call("request-id-0000002")).status, 409);
    resolve(output()); assert.equal((await first).status, 200); assert.equal(calls, 1);
  }, () => { calls++; began(); return new Promise(r => { resolve = r; }); });
});
test("budget cap blocks calls before spending; unknown upstream failures retain reservations", async () => {
  let calls = 0;
  await gateway(async ({ call }) => { assert.equal((await call("request-id-0000001")).status, 402); assert.equal(calls, 0); }, async () => { calls++; return output(); }, 1);
  await gateway(async ({ call, ledger }) => { assert.equal((await call("request-id-0000001")).status, 502); assert.ok(ledger.budget().reservedUsd > 0); }, async () => { throw new Error("lost acknowledgement SECRET"); });
});
test("invalid provider payload still charges known usage without exposing raw errors", async () => {
  await gateway(async ({ call, ledger }) => {
    const response = await call("request-id-0000001"); assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes("SECRET"));
    assert.equal(ledger.budget().usedUsd, 0.00015);
  }, async () => ({ ...output(), text: "SECRET invalid JSON" }));
});
test("durable reservations survive restart and calendar-month budgets reset", () => {
  const dir = mkdtempSync(join(tmpdir(), "gymbeam-coach-"));
  const file = join(dir, "budget.sqlite");
  let date = Date.UTC(2026, 9, 14);
  let ledger = new CoachLedger(file, 1000, () => date);
  try {
    ledger.reserve("request-id-0000001", "a", 700); ledger.close();
    ledger = new CoachLedger(file, 1000, () => date); ledger.recoverInterrupted();
    assert.equal(ledger.budget().reservedUsd, 700 / 1e9);
    assert.throws(() => ledger.reserve("request-id-0000002", "b", 400));
    date = Date.UTC(2026, 10, 1);
    assert.equal(ledger.budget().reservedUsd, 0);
    assert.equal(ledger.reserve("request-id-0000002", "b", 400), null);
  } finally { ledger.close(); rmSync(dir, { recursive: true, force: true }); }
});
test("provider requests have no tools, disabled storage, bounded tokens and conservative reservations", () => {
  const body = coachBody(ctx());
  assert.equal(body.store, false); assert.equal(body.max_output_tokens, 2400);
  assert.equal(body.reasoning.effort, "none"); assert.equal(body.tools, undefined);
  assert.equal(body.service_tier, "default");
  assert.equal(body.text.format.type, "json_schema"); assert.ok(reserveCost(ctx()) > 2400 * 500);
});
test("monthly output has a separate strict format and a fully reserved 6000-token ceiling", () => {
  const context = ctx(); context.task = "month_plan";
  const body = coachBody(context);
  assert.equal(body.max_output_tokens, 6000);
  assert.ok(body.text.format.schema.properties.monthly);
  assert.equal(coachBody(ctx()).text.format.schema.properties.monthly, undefined);
  assert.ok(reserveCost(context) > reserveCost(ctx()));
});
test("known monthly usage above the ordinary 2400-token limit is settled, not lost", async () => {
  const context = ctx(); context.task = "month_plan";
  await gateway(async ({ call, ledger }) => {
    assert.equal((await call("monthly-usage-0001", context)).status, 200);
    assert.equal(ledger.budget().usedUsd, 0.0026); assert.equal(ledger.budget().reservedUsd, 0);
  }, async () => ({ ...output(), outputTokens: 5000, text: JSON.stringify({ ...reply, monthly: null }) }));
});
test("provider explicitly distinguishes performed timed sets from the unperformed draft", () => {
  const context = ctx();
  const timed = { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 45, rir: null, technique: null };
  context.task = "next_set";
  context.focus = { workoutId: 1, finished: false, draftRevision: 0, draft: timed };
  context.sessions = [{ id: 1, finishedAt: null, sets: [timed] }];
  const input = JSON.parse(coachBody(context).input);
  assert.deepEqual(input.context, context);
  assert.equal(input.focusEvidence.recordedSetCount, 1);
  assert.equal(input.focusEvidence.recentRecordedSets[0].durationSeconds, 45);
  assert.equal(input.focusEvidence.draftIsPerformedSet, false);
  assert.equal(JSON.parse(coachBody(ctx()).input).focusEvidence, null);
});
test("an incomplete response is charged but never exposed as a completed recommendation", async () => {
  await gateway(async ({ call, ledger }) => {
    assert.equal((await call("request-id-0000001")).status, 502);
    assert.equal(ledger.budget().usedUsd, 0.00015);
    assert.equal(ledger.budget().reservedUsd, 0);
  }, async () => ({ ...output(), completed: false }));
});
test("official SDK adapter uses the expected REST contract and extracts completed output", async () => {
  let calls = 0;
  const provider = openAiProvider("sk-fake-test-key", async (url, options) => {
    calls++; assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(new Headers(options.headers).get("authorization"), "Bearer sk-fake-test-key");
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.model, "gpt-6-luna");
    return new Response(JSON.stringify({ id: "resp_test", object: "response", status: "completed", output: [{ type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(reply), annotations: [] }] }], usage: { input_tokens: 1000, output_tokens: 100, total_tokens: 1100 } }), { headers: { "Content-Type": "application/json" } });
  });
  assert.deepEqual(await provider(ctx()), output()); assert.equal(calls, 1);
});
test("official SDK never automatically retries a failed paid request", async () => {
  let calls = 0;
  const provider = openAiProvider("sk-fake-test-key", async () => { calls++; return new Response(JSON.stringify({ error: { message: "Test failure" } }), { status: 500, headers: { "Content-Type": "application/json" } }); });
  await assert.rejects(provider(ctx())); assert.equal(calls, 1);
});
