import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { mock } from "node:test";
import { performance } from "node:perf_hooks";
import { storage, request } from "./testHarness.mjs";
import { DISCIPLINES, msmcTarget, requiredStrengthKg } from "@workspace/level-data/strength";

const { exportProgress, restoreProgress, parseProgressBackup } = await import("../lib/progressBackup.ts");
const output = new URL("../../apk/journey/", import.meta.url);
const start = Date.UTC(2023, 0, 2, 18);
mock.timers.enable({ apis: ["Date"], now: start });
const report = {
  scenario: "Three weekly full-body sessions; progressive 2.5 kg steps; every 8th week deload; two 14-day breaks; 75 kg male profile",
  maxWeeks: 208, milestones: [], findings: [], checks: [], sessions: [],
};
let simulatedNow = start;
const clock = () => mock.timers.setTime(simulatedNow);
const roundWeight = (weight) => Math.round(weight / 2.5) * 2.5;
const sessions = [
  [[1, 20, 80], [12, 20, 100], [8, 20, 65], [19, 20, 45], [3, 10, 32.5]],
  [[6, 40, 125], [2, 20, 65], [13, 30, 85], [20, 10, 30], [10, 20, 60]],
  [[14, 40, 160], [3, 10, 32.5], [8, 20, 65], [20, 10, 30], [1, 20, 80]],
];

try {
  storage.clear();
  await request("/api/profile", "PUT", { sex: "male", bodyWeightKg: 75, heightCm: 178 });
  const exercises = await request("/api/exercises");
  const names = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  report.exercises = sessions.map((session) => session.map(([id, from, to]) => ({ name: names.get(id), from, to })));
  let previousLevel = 0;
  let expectedSets = 0;
  let expectedVolume = 0;
  const trained = new Set();
  const wallStart = performance.now();
  for (let week = 0; week < report.maxWeeks; week++) {
    if (week === 24 || week === 76) {
      simulatedNow += 14 * 86400000;
      clock();
      const afterBreak = await request("/api/levels");
      assert.equal(afterBreak.currentLevel, previousLevel, "A break must not remove confirmed progress");
      report.checks.push({ week, kind: "two-week-break", level: afterBreak.currentLevel });
    }
    for (let day = 0; day < 3; day++) {
      const workout = await request("/api/workouts", "POST", { name: `Week ${week + 1}, session ${day + 1}` });
      const beforeStats = await request("/api/stats/overview");
      const deload = week % 8 === 7;
      let volume = 0;
      for (const [exerciseId, initial, ceiling] of sessions[day]) {
        // Improvements slow after six months; this is test data, not a training prescription.
        const progression = Math.min(1, (Math.min(week, 24) + Math.max(0, week - 24) * 0.35) / 60);
        const working = roundWeight((initial + (ceiling - initial) * progression) * (deload ? 0.8 : 1));
        const weightKg = Math.max(exercises.find((exercise) => exercise.id === exerciseId).equipment === "barbell" ? 20 : 2.5, working);
        for (let set = 0; set < (deload ? 2 : 3); set++) {
          const reps = 8 + ((week + set) % 3);
          await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, weightKg, reps });
          trained.add(exerciseId);
          volume += weightKg * reps;
          expectedSets++;
          simulatedNow += 3 * 60000;
          clock();
        }
      }
      assert.equal((await request("/api/stats/overview")).totalWorkouts, beforeStats.totalWorkouts, "Active workout is excluded from completed statistics");
      await request(`/api/workouts/${workout.id}/finish`, "POST");
      expectedVolume += volume;
      const stats = await request("/api/stats/overview");
      assert.equal(stats.totalVolume, expectedVolume);
      assert.equal(stats.totalWorkouts, report.sessions.length + 1);
      const levels = await request("/api/levels");
      assert.ok(levels.currentLevel >= previousLevel, "Completed training must not decrease level");
      assert.ok(levels.currentLevel <= 80);
      const secondRead = await request("/api/levels");
      assert.equal(secondRead.currentLevel, levels.currentLevel, "Opening Levels twice cannot award extra levels");
      assert.equal(secondRead.stats.currentTonnageSinceLevelUp, levels.stats.currentTonnageSinceLevelUp, "Opening Levels twice cannot consume progress");
      if (levels.currentLevel > previousLevel) {
        report.milestones.push({ week: week + 1, workout: workout.id, from: previousLevel, to: levels.currentLevel, name: levels.levels[levels.currentLevel].name, trainedExercises: trained.size });
        if (trained.size < 10 && levels.currentLevel - previousLevel >= 10) {
          report.findings.push({ kind: "large-early-skip", week: week + 1, from: previousLevel, to: levels.currentLevel, trainedExercises: trained.size });
        }
      }
      previousLevel = levels.currentLevel;
      report.sessions.push({ week: week + 1, day: day + 1, deload, volume, level: previousLevel, tonnageToNext: Math.max(0, (levels.nextLevelTonnage7dKgRequired ?? 0) - levels.stats.currentTonnageSinceLevelUp) });
      if (report.sessions.length % 30 === 0) {
        const text = await exportProgress();
        await restoreProgress(text);
        assert.equal((await parseProgressBackup(await exportProgress())).state.sets.length, expectedSets);
        assert.equal((await request("/api/levels")).currentLevel, previousLevel);
        report.checks.push({ kind: "backup-round-trip", workout: workout.id, sets: expectedSets });
      }
      if (previousLevel === 80) break;
      simulatedNow += (day === 2 ? 3 : 2) * 86400000 - 45 * 60000;
      clock();
    }
    if (week % 12 === 0 || previousLevel === 80) console.log(`Week ${week + 1}: level ${previousLevel}, ${report.sessions.length} workouts, ${expectedSets} sets`);
    if (previousLevel === 80) break;
  }
  report.final = { level: previousLevel, workouts: report.sessions.length, sets: expectedSets, totalVolume: expectedVolume, wallSeconds: Math.round((performance.now() - wallStart) / 1000) };
  const completeHistory = await request(`/api/workouts?limit=${report.sessions.length + 50}`);
  assert.equal(completeHistory.length, 624, "All older workouts must remain accessible beyond the first 50");
  assert.equal(completeHistory.at(-1).id, 1);
  assert.ok(previousLevel > 0 && previousLevel < 80, "Ordinary working weights cannot earn international-class targets");
  assert.equal(previousLevel, 12, "The 100 kg squat has not reached the 112.5 kg III rank threshold");
  report.checks.push({kind: "realistic-plateau", level: previousLevel});
  assert.equal((await request("/api/stats/forecast")).estimatedDays, null);
  // Separate boundary fixtures; these are not average workouts or a training prescription.
  const ids = {bench:1, squat:12, deadlift:6};
  for (const targetLevel of [40,50,60,70,79,80]) {
    simulatedNow += 7 * 86400000;
    clock();
    const workout = await request("/api/workouts", "POST", {name:`Elite boundary ${targetLevel}`});
    for (const {lift} of DISCIPLINES) {
      await request(`/api/workouts/${workout.id}/sets`, "POST", {
        exerciseId:ids[lift], weightKg:requiredStrengthKg(lift,targetLevel,75,"male"), reps:1,
      });
    }
    await request(`/api/workouts/${workout.id}/finish`, "POST");
    const reached = await request("/api/levels");
    assert.ok(reached.currentLevel >= targetLevel);
    assert.equal((await request("/api/levels")).currentLevel, reached.currentLevel);
    report.checks.push({kind:"elite-boundary", targetLevel, actual:reached.currentLevel});
  }
  const text = await exportProgress();
  await restoreProgress(text);
  assert.equal((await request("/api/levels")).currentLevel, 80);
  report.eliteFinalLevel = 80;
  assert.equal((await request("/api/levels")).nextLevel, null);
  assert.equal((await request("/api/stats/forecast")).confidence, "achieved");
} catch (error) {
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  mock.timers.reset();
  await mkdir(output, { recursive: true });
  await writeFile(new URL("progression-report.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report.final, error: report.error?.message, findings: report.findings }, null, 2));
}
