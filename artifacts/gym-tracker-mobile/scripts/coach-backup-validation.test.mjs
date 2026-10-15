import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { request, storage } from "./testHarness.mjs";
const { exportProgress, parseProgressBackup, restoreProgress } = await import("../lib/progressBackup.ts");
const { startTimer } = await import("../lib/trainingCoach.ts");

test("checksummed malformed coach fields and timer references cannot replace progress", async () => {
  storage.clear();
  const active = await request("/api/workouts", "POST", {});
  await request(`/api/workouts/${active.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 8, setType: "working", rir: 2 });
  const original = await exportProgress();
  for (const corrupt of [
    state => { state.sets[0].rir = 6; },
    state => { state.sets[0].setType = "fake"; },
    state => { state.sets[0].technique = "fake"; },
    state => { state.workouts[0].restSeconds = 0; },
    state => { state.workouts[0].timer = startTimer("plank", 30, 999); },
    state => { state.workouts[0].timer = startTimer("plank", 30, 1); },
    state => { state.workouts[0].timer = startTimer("rest", 30); state.workouts[0].timer.remainingMs = 40000; },
  ]) {
    const bad = JSON.parse(original);
    corrupt(bad.state);
    bad.checksum = createHash("sha256").update(JSON.stringify({ state: bad.state, plans: bad.plans })).digest("hex");
    await assert.rejects(parseProgressBackup(JSON.stringify(bad)));
    await assert.rejects(restoreProgress(JSON.stringify(bad)));
    assert.deepEqual(JSON.parse(await exportProgress()).state, JSON.parse(original).state);
  }
});
