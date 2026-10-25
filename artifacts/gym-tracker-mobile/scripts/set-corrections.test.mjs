import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test, beforeEach, afterEach, mock } from "node:test";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile } from "@workspace/ai-coach";
const { PROGRESS_KEY, PLAN_PREFIX, AUTO_BACKUP_JOBS_KEY } = await import("../lib/progressStorage.ts");
const { exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const { setValues } = await import("../lib/setEditing.ts");
const now = Date.parse("2026-10-25T10:00:00Z");
beforeEach(() => { storage.clear(); globalThis.__storageFault = undefined; mock.timers.enable({ apis: ["Date"], now }); });
afterEach(() => { mock.timers.reset(); globalThis.__storageFault = undefined; });
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
const draftUrl = id => `/api/workouts/${id}/draft`;
const values = (set, changes) => ({ ...setValues(set), ...changes });
const patch = (set, changes, revision = set.revision ?? 0) => request(`/api/sets/${set.id}`, "PATCH", { revision, values: values(set, changes) });
async function record(exerciseId = 1, weightKg = 50, reps = 10, extra = {}) {
  const workout = await request("/api/workouts", "POST");
  const set = await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, weightKg, reps, rir: 2, technique: "good", ...extra });
  return { workout, set };
}
async function ratedDraft(rir = 5) {
  const w = await request("/api/workouts", "POST");
  const saved = await request(draftUrl(w.id), "PUT", { revision: 0, draft: { exerciseId: 1, weightKg: 50, reps: 10, rir, technique: "good" } });
  return { w, saved };
}
test("inherited positions survive commits and backup but do not masquerade as new feedback", async () => {
  const { w, saved } = await ratedDraft();
  const first = await request(draftUrl(w.id) + "/commit", "POST", { revision: saved.revision });
  assert.equal(first.set.rir, 5); assert.equal(first.draft.rir, 5);
  assert.deepEqual(first.assessment, { rir: false, technique: false });
  await restoreProgress(await exportProgress());
  const current = await request(draftUrl(w.id));
  assert.deepEqual(current, { draft: first.draft, revision: first.revision, assessment: first.assessment });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: w.id });
  assert.equal(context.focus.draft.rir, null); assert.equal(context.focus.draft.technique, null);
  const second = await request(draftUrl(w.id) + "/commit", "POST", { revision: current.revision });
  assert.equal(second.set.rir, null); assert.equal(second.set.technique, null);
  assert.equal(second.draft.rir, 5); assert.equal(second.draft.technique, "good");
});
test("explicit same-value confirmation becomes fresh and idempotent commit never creates duplicates", async () => {
  const { w, saved } = await ratedDraft();
  const first = await request(draftUrl(w.id) + "/commit", "POST", { revision: saved.revision });
  const confirmed = await request(draftUrl(w.id), "PUT", { revision: first.revision, draft: first.draft, assessment: { rir: true, technique: true } });
  const context = await request("/api/ai-coach/context", "POST", { task: "next_set", workoutId: w.id });
  assert.equal(context.focus.draft.rir, 5); assert.equal(context.focus.draft.technique, "good");
  const second = await request(draftUrl(w.id) + "/commit", "POST", { revision: confirmed.revision });
  const repeated = await request(draftUrl(w.id) + "/commit", "POST", { revision: confirmed.revision });
  assert.equal(second.set.rir, 5); assert.equal(repeated.set.id, second.set.id); assert.equal(state().sets.length, 2);
});
test("numeric edits alone do not confirm inherited feedback; choosing one assessment leaves the other unknown", async () => {
  const { w, saved } = await ratedDraft(2);
  const first = await request(draftUrl(w.id) + "/commit", "POST", { revision: saved.revision });
  const numeric = await request(draftUrl(w.id), "PUT", { revision: first.revision, draft: { ...first.draft, weightKg: 52.5 } });
  assert.deepEqual(numeric.assessment, { rir: false, technique: false });
  const assessed = await request(draftUrl(w.id), "PUT", { revision: numeric.revision, draft: { ...numeric.draft, rir: 3 }, assessment: { rir: true } });
  assert.deepEqual(assessed.assessment, { rir: true, technique: false });
  const result = await request(draftUrl(w.id) + "/commit", "POST", { revision: assessed.revision });
  assert.equal(result.set.rir, 3); assert.equal(result.set.technique, null);
});
test("legacy active drafts retain values conservatively, and invalid or stale confirmation cannot overwrite input", async () => {
  const { w } = await ratedDraft(2), raw = state(); delete raw.workouts[0].draftAssessment;
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
  const current = await request(draftUrl(w.id));
  assert.equal(current.draft.rir, 2); assert.deepEqual(current.assessment, { rir: false, technique: false });
  const before = new Map(storage);
  await assert.rejects(request(draftUrl(w.id), "PUT", { revision: 0, draft: current.draft, assessment: { rir: true } }), { status: 409 });
  await assert.rejects(request(draftUrl(w.id), "PUT", { revision: current.revision, draft: { ...current.draft, rir: null }, assessment: { rir: true } }), { status: 400 });
  await assert.rejects(request(draftUrl(w.id), "PUT", { revision: current.revision, draft: current.draft, assessment: { rir: "yes" } }), { status: 400 });
  assert.deepEqual(storage, before);
});
test("finished set correction recomputes volume, records and forecast without changing identity or dates", async () => {
  const { workout, set } = await record(1, 80, 10);
  await request(`/api/workouts/${workout.id}/finish`, "POST");
  const before = structuredClone(state()), oldOutlook = await request("/api/exercises/1/outlook");
  mock.timers.tick(2000);
  const edited = await patch(set, { weightKg: 50, reps: 8, rir: 3 });
  assert.equal(edited.id, set.id); assert.equal(edited.createdAt, set.createdAt); assert.equal(edited.revision, 1);
  assert.ok(edited.editedAt); assert.equal(edited.volume, 400);
  const full = await request(`/api/workouts/${workout.id}`);
  assert.equal(full.totalVolume, 400); assert.equal(full.startedAt, before.workouts[0].startedAt); assert.equal(full.finishedAt, before.workouts[0].finishedAt);
  const ex = (await request("/api/exercises")).find(e => e.id === 1); assert.equal(ex.userMaxKg, 50);
  assert.notEqual((await request("/api/exercises/1/outlook")).initialWeightKg, oldOutlook.initialWeightKg);
  assert.equal(state().nextSetId, before.nextSetId); assert.equal(state().sets.length, 1);
  assert.equal(JSON.parse(storage.get(AUTO_BACKUP_JOBS_KEY))[0].finishedAt, full.finishedAt);
});
test("correction preserves recorded bodyweight and paired-dumbbell snapshots despite subsequent profile edits", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  await request("/api/exercises/3", "PATCH", { dumbbellCount: 2 });
  const { workout, set: body } = await record(7, 0);
  const dumbbell = await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId: 3, weightKg: 20, reps: 10 });
  await request("/api/profile", "PUT", { bodyWeightKg: 90 });
  const a = await patch(body, { weightKg: 5 }); assert.equal(a.bodyWeightKg, 80); assert.equal(a.volume, 850);
  const b = await patch(dumbbell, { weightKg: 22.5 }); assert.equal(b.dumbbellCount, 2); assert.equal(b.volume, 450);
});
test("assisted correction uses original bodyweight, never today's higher profile value", async () => {
  await request("/api/profile", "PUT", { bodyWeightKg: 80 });
  const ex = await request("/api/exercises", "POST", { name: "Assisted correction", muscleGroup: "Спина", equipment: "machine", loadMode: "assisted" });
  const { set } = await record(ex.id, 30);
  await request("/api/profile", "PUT", { bodyWeightKg: 90 });
  const before = new Map(storage); await assert.rejects(patch(set, { weightKg: 85 }), { status: 400 }); assert.deepEqual(storage, before);
  const result = await patch(set, { weightKg: 35 }); assert.equal(result.bodyWeightKg, 80); assert.equal(result.effectiveWeightKg, 45); assert.equal(result.volume, 450);
});
test("editing respects historical barbell units even after the catalog category changed", async () => {
  const { set } = await record();
  await request("/api/exercises/1", "PATCH", { equipment: "other" });
  const before = new Map(storage); await assert.rejects(patch(set, { weightKg: 2.5 }), { status: 400 }); assert.deepEqual(storage, before);
  const result = await patch(set, { weightKg: 55 }); assert.equal(result.equipment, "barbell");
});
test("timed corrections remain seconds and reject weights, repetitions, RIR and fractional time", async () => {
  const { set } = await record(30, 0, 0, { durationSeconds: 45, rir: null });
  for (const changes of [{ weightKg: 5 }, { reps: 10 }, { rir: 2 }, { durationSeconds: 0 }, { durationSeconds: 60.5 }]) await assert.rejects(patch(set, changes), { status: 400 });
  const result = await patch(set, { durationSeconds: 60 }); assert.equal(result.durationSeconds, 60); assert.equal(result.volume, 0); assert.equal(result.createdAt, set.createdAt);
});
test("stale conflicting edits fail; identical replay after a lost acknowledgement is idempotent", async () => {
  const { set } = await record();
  const first = await patch(set, { reps: 12 }); mock.timers.tick(1000);
  const replay = await patch(set, { reps: 12 }); assert.deepEqual(replay, first);
  await assert.rejects(patch(set, { reps: 11 }), { status: 409 });
  await assert.rejects(request(`/api/sets/${set.id}`, "PATCH", { revision: 1, values: { ...setValues(first), createdAt: new Date().toISOString() } }), { status: 400 });
  assert.equal(state().sets.length, 1); assert.equal(state().sets[0].revision, 1);
});
test("v11 backup round-trip retains corrections and assessment provenance without changing the strict draft format", async () => {
  const { w, saved } = await ratedDraft(2);
  const committed = await request(draftUrl(w.id) + "/commit", "POST", { revision: saved.revision });
  await patch(committed.set, { weightKg: 52.5 });
  const original = structuredClone(state()), backup = await exportProgress(); assert.equal(JSON.parse(backup).version, 11);
  await restoreProgress(backup); assert.deepEqual(state(), original);
  assert.equal((await request(draftUrl(w.id))).assessment.rir, false);
});
async function daily() {
  await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy" });
  for (let day = 0; day < 2; day++) {
    const w = await request("/api/workouts", "POST");
    for (let n = 0; n < 3; n++) await request(`/api/workouts/${w.id}/sets`, "POST", { exerciseId: 1, weightKg: 50, reps: 12, rir: 2, technique: "good" });
    await request(`/api/workouts/${w.id}/finish`, "POST"); mock.timers.tick(1000);
  }
  const pull = await request("/api/workouts", "POST");
  await request(`/api/workouts/${pull.id}/sets`, "POST", { exerciseId: 7, weightKg: 0, reps: 8, rir: 2, technique: "good" });
  await request(`/api/workouts/${pull.id}/finish`, "POST"); mock.timers.tick(1000);
  const preview = await request("/api/daily-workout?split=push");
  return request("/api/daily-workout/start", "POST", { fingerprint: preview.fingerprint, splitDay: "push" });
}
test("historical corrections refresh pending daily targets and untouched draft but preserve a manually edited draft", async () => {
  for (const manual of [false, true]) {
    storage.clear(); const w = await daily(), d = await request(draftUrl(w.id));
    assert.equal(d.draft.weightKg, 52.5);
    if (manual) await request(draftUrl(w.id), "PUT", { revision: d.revision, draft: { ...d.draft, weightKg: 47.5, reps: 9 } });
    for (const set of state().sets.filter(set => set.exerciseId === 1).slice(-3)) await patch(set, { weightKg: 40, reps: 8, rir: 2 });
    const plan = JSON.parse(storage.get(PLAN_PREFIX + w.id)).exercises.find(e => e.exerciseId === 1);
    const fresh = await request(draftUrl(w.id));
    assert.ok(plan.setTargets[0].weightKg < 52.5);
    assert.equal(fresh.draft.weightKg, manual ? 47.5 : plan.setTargets[0].weightKg);
    assert.equal(fresh.draft.reps, manual ? 9 : plan.setTargets[0].reps);
    await assert.rejects(request(draftUrl(w.id), "PUT", { revision: d.revision, draft: d.draft }), { status: 409 });
  }
});
test("active daily correction preserves completed targets and refreshes only pending assignments", async () => {
  const w = await daily(), d = await request(draftUrl(w.id));
  const committed = await request(draftUrl(w.id) + "/commit", "POST", { revision: d.revision });
  const before = JSON.parse(storage.get(PLAN_PREFIX + w.id)).exercises.find(e => e.exerciseId === 1);
  const corrected = await patch(committed.set, { weightKg: 50, reps: 10, rir: 4, technique: "good" });
  const after = JSON.parse(storage.get(PLAN_PREFIX + w.id)).exercises.find(e => e.exerciseId === 1);
  assert.deepEqual(after.setTargets[0], before.setTargets[0]);
  assert.equal(after.setTargets.length, before.setTargets.length);
  assert.equal(state().sets.find(s => s.id === corrected.id).weightKg, 50);
  const fresh = await request(draftUrl(w.id));
  assert.equal(fresh.draft.weightKg, after.setTargets[1].weightKg);
  assert.equal(fresh.draft.reps, after.setTargets[1].reps);
  assert.equal(fresh.revision, committed.revision + 1);
});

test("editing active results leaves completed targets, timer, literal templates and idempotent commit history intact", async () => {
  const program = await request("/api/programs", "POST", { name: "Literal", exercises: [{ exerciseId: 1, sets: 2, repsMin: 8, repsMax: 12, intent: "hypertrophy", setTargets: [{ weightKg: 50, reps: 8 }, { weightKg: 47.5, reps: 10 }] }] });
  const w = await request("/api/workouts", "POST", { programId: program.id });
  let d = await request(draftUrl(w.id));
  d = await request(draftUrl(w.id), "PUT", { revision: d.revision, draft: { ...(d.draft ?? { exerciseId: 1, weightKg: 50, reps: 8 }), rir: 2, technique: "good" } });
  const result = await request(draftUrl(w.id) + "/commit", "POST", { revision: d.revision });
  const timer = { kind: "rest", totalMs: 120000, remainingMs: 90000, endsAt: null };
  await request(`/api/workouts/${w.id}/timer`, "PUT", timer);
  const raw = structuredClone(state()), plan = storage.get(PLAN_PREFIX + w.id);
  const edited = await patch(result.set, { weightKg: 55 });
  assert.deepEqual(state().customPrograms, raw.customPrograms); assert.equal(storage.get(PLAN_PREFIX + w.id), plan);
  assert.deepEqual(state().workouts.find(x => x.id === w.id).timer, timer);
  const replay = await request(draftUrl(w.id) + "/commit", "POST", { revision: d.revision });
  assert.equal(replay.set.id, edited.id); assert.equal(replay.set.weightKg, 55); assert.equal(state().sets.length, 1);
});
for (const phase of ["before", "after"]) test(`an interrupted correction transaction rolls back history and backup job (${phase} state write)`, async () => {
  const { workout, set } = await record(); await request(`/api/workouts/${workout.id}/finish`, "POST");
  storage.set(AUTO_BACKUP_JOBS_KEY, "[]"); const before = structuredClone(state());
  globalThis.__storageFault = event => {
    if (event.key === PROGRESS_KEY && event.operation === "multiSet" && event.phase === phase) { globalThis.__storageFault = undefined; throw new Error("Correction interrupted"); }
  };
  await assert.rejects(patch(set, { reps: 12 }), /interrupted/);
  await request("/api/exercises"); assert.deepEqual(state(), before); assert.equal(storage.get(AUTO_BACKUP_JOBS_KEY), "[]");
  const retry = await patch(set, { reps: 12 }); assert.equal(retry.reps, 12); assert.equal(JSON.parse(storage.get(AUTO_BACKUP_JOBS_KEY)).length, 1);
});
test("compact workflow and both editors use native controls and preserve Android resize/modal gesture roots", () => {
  const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const editor = read("components/SetEditor.tsx"), screen = read("app/workout/[id]/index.tsx");
  assert.match(editor, /GestureHandlerRootView/); assert.match(editor, /Platform\.OS === "ios" \? "padding" : undefined/);
  assert.doesNotMatch(editor, /TextInput/); assert.match(editor, /step=\{step\}/);
  assert.match(screen, /<TrainingTimer compact/); assert.match(screen, /accessibilityRole="checkbox"/);
  assert.match(screen, /showDetails \?/); assert.match(screen, /<SetEditor/);
  assert.match(read("app/history/[id].tsx"), /<SetEditor/);
});
