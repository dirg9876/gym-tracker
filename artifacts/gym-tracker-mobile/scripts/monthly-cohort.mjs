import assert from "node:assert/strict";
import { mock } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { storage, request } from "./testHarness.mjs";
import { defaultCoachProfile, goalPrescription } from "@workspace/ai-coach";
const { PROGRESS_KEY } = await import("../lib/progressStorage.ts");
const { loadPlan } = await import("../lib/programPlanStash.ts");
const { plannedSet } = await import("../lib/workoutTemplates.ts");
const { buildDailyWorkout } = await import("../lib/dailyWorkout.ts");
const { parseProgressBackup, exportProgress, restoreProgress } = await import("../lib/progressBackup.ts");
const start = Date.UTC(2026, 0, 5, 17), DAY = 86400000;
const state = () => JSON.parse(storage.get(PROGRESS_KEY));
export const COHORT = [
  { id: "novice", label: "Новичок, мужчина, 27 лет", sex: "male", mass: 75, bench: 60, days: [0, 2, 4], growth: 0.06, fatigue: 0.7, seed: false },
  { id: "intermediate", label: "Опытный, мужчина, 34 года", sex: "male", mass: 88, bench: 110, days: [0, 1, 3, 5], growth: 0.015, fatigue: 0.6, seed: true },
  { id: "dumbbells", label: "Опытная, женщина, 32 года, микрошаг гантелей", sex: "female", mass: 64, bench: 50, days: [0, 2, 4], growth: 0.025, fatigue: 0.65, seed: true, dumbbellStep: 1 },
  { id: "large-stack", label: "Тренажёры с шагом 5 кг", sex: "male", mass: 92, bench: 100, days: [0, 2, 4], growth: 0.04, fatigue: 0.4, seed: true, machineStep: 5 },
  { id: "returning", label: "Возвращение после перерыва, 38 лет", sex: "male", mass: 95, bench: 85, days: [0, 2, 4], growth: 0.08, fatigue: 0.6, seed: true, seedAge: 42, initialCapacity: 0.8 },
  { id: "busy", label: "Два занятия в неделю и пропуски, 55 лет", sex: "female", mass: 70, bench: 45, days: [0, 3], growth: 0.02, fatigue: 0.8, seed: true, skip: [10, 14] },
  { id: "fatigue", label: "Временное снижение работоспособности", sex: "male", mass: 83, bench: 90, days: [0, 2, 4], growth: 0.02, fatigue: 1, seed: true, badDays: [9, 11], capacityDrop: 0.22 },
  { id: "missing-feedback", label: "Две недели без оценок RIR и техники", sex: "male", mass: 80, bench: 80, days: [0, 2, 4], growth: 0.03, fatigue: 0.7, seed: true, missingUntil: 14 },
];
// Synthetic hidden capacities are fixture assumptions, not conversions or human outcome predictions.
const factors = { 1: 1, 2: 0.85, 3: 0.4, 5: 0.18, 6: 1.65, 8: 0.75, 9: 0.4, 10: 0.8, 11: 0.8,
  12: 1.25, 13: 1.05, 14: 2.2, 15: 0.3, 16: 0.55, 17: 0.65, 18: 0.95, 19: 0.6, 20: 0.3,
  21: 0.12, 22: 0.1, 23: 0.35, 24: 0.18, 25: 0.2, 26: 0.35, 27: 0.45 };
function capacity(person, exercise, day, ordinal, kg) {
  const recovery = person.badDays?.includes(day) ? 1 - person.capacityDrop : 1;
  if (exercise.equipment === "bodyweight") return Math.max(1, Math.floor((exercise.id === 7 ? 7 : 14) * recovery + day / 28 * 2 - person.fatigue * ordinal));
  const initial = person.initialCapacity ?? 1;
  const strength = person.bench * (factors[exercise.id] ?? 0.5) * (initial + person.growth * Math.max(0, day) / 28) * recovery;
  // Brzycki-style rep capacity is independent of the production Epley/EMA predictor.
  return Math.max(1, Math.floor(37 - 36 * kg / strength - person.fatigue * ordinal));
}
const response = (person, exercise, day, ordinal, target) => {
  if (target.durationSeconds != null) return { weightKg: 0, reps: 0, durationSeconds: Math.min(target.durationSeconds, 40), rir: null, technique: "good" };
  const possible = capacity(person, exercise, day, ordinal, target.weightKg);
  const reps = Math.max(1, Math.min(target.reps, possible));
  const missing = day >= 0 && day < (person.missingUntil ?? 0);
  return { weightKg: target.weightKg, reps, rir: missing ? null : Math.min(5, Math.max(0, possible - reps)),
    technique: missing ? null : person.badDays?.includes(day) && ordinal === 0 && possible < target.reps ? "breakdown" : "good" };
};
async function seedHistory(person) {
  if (!person.seed) return;
  const raw = state();
  for (const [index, phase] of ["push", "pull", "legs"].entries()) {
    const date = new Date(start - ((person.seedAge ?? 7) - index * 2) * DAY);
    const plan = buildDailyWorkout(raw, date, phase).plan;
    if (!plan) continue;
    const id = raw.nextWorkoutId++;
    raw.workouts.push({ id, name: `Synthetic prior ${phase}`, splitDay: phase, startedAt: date.toISOString(), finishedAt: new Date(+date + 60 * 60000).toISOString() });
    for (const item of plan.exercises) {
      const ex = raw.exercises.find(ex => ex.id === item.exerciseId), min = ex.equipment === "barbell" ? 20 : 0, step = ex.weightStepKg ?? 2.5;
      const kg = ex.equipment === "bodyweight" ? 0 : Math.max(min, min + Math.floor((person.bench * (factors[ex.id] ?? 0.5) * 0.65 - min) / step) * step);
      for (let i = 0; i < (item.postCalibrationSets ?? 0) + item.sets; i++) {
        const timed = item.setTargets[0].durationSeconds != null;
        const actual = response({ ...person, initialCapacity: 1 }, ex, -1, i, timed ? { durationSeconds: 30 } : { weightKg: kg, reps: 10 });
        raw.sets.push({ ...actual, equipment: ex.equipment, ...(ex.equipment === "dumbbell" ? { dumbbellCount: ex.dumbbellCount ?? 1 } : {}),
          ...(ex.equipment === "bodyweight" && !timed ? { bodyWeightKg: person.mass } : {}),
          id: raw.nextSetId++, workoutId: id, exerciseId: ex.id, createdAt: new Date(+date + i * 180000).toISOString() });
      }
    }
  }
  storage.set(PROGRESS_KEY, JSON.stringify(raw));
}

export async function simulatePerson(person) {
  storage.clear(); mock.timers.enable({ apis: ["Date"], now: start });
  const diary = [], findings = [], checks = { belowBarbell: 0, outOfRange: 0, repeatedSplit: 0, missingLoads: 0, responseFailures: 0, easyWorkingSets: 0 };
  try {
    await request("/api/profile", "PUT", { sex: person.sex, bodyWeightKg: person.mass, heightCm: 172 });
    await request("/api/ai-coach/profile", "PUT", { ...defaultCoachProfile(), goal: "hypertrophy", daysPerWeek: person.days.length });
    for (const ex of await request("/api/exercises")) {
      const step = ex.equipment === "machine" ? person.machineStep : ex.equipment === "dumbbell" ? person.dumbbellStep : undefined;
      if (step) await request(`/api/exercises/${ex.id}`, "PATCH", { weightStepKg: step });
    }
    await seedHistory(person);
    let previousSplit;
    for (let day = 0; day < 28; day++) {
      if (!person.days.includes(day % 7) || person.skip?.includes(day)) continue;
      mock.timers.setTime(start + day * DAY);
      const preview = await request("/api/daily-workout");
      assert.ok(preview.plan, `${person.id}: expected a real algorithm workout`);
      checks.repeatedSplit += Number(preview.splitDay === previousSplit);
      previousSplit = preview.splitDay;
      const workout = await request("/api/daily-workout/start", "POST", { fingerprint: preview.fingerprint, splitDay: preview.splitDay });
      const session = { day: day + 1, date: new Date().toISOString().slice(0, 10), split: preview.splitDay, exercises: [] };
      diary.push(session);
      const exerciseIds = preview.plan.exercises.map(ex => ex.exerciseId);
      for (const exerciseId of exerciseIds) {
        const ex = state().exercises.find(ex => ex.id === exerciseId), prescription = goalPrescription("hypertrophy", ex);
        const entry = { id: exerciseId, name: ex.name, equipment: ex.equipment, sets: [] };
        session.exercises.push(entry);
        for (let ordinal = 0; ordinal < 6; ordinal++) {
          const item = (await loadPlan(workout.id)).exercises.find(row => row.exerciseId === exerciseId);
          if (ordinal >= item.sets) break;
          const forecast = await request(`/api/workouts/${workout.id}/prediction/${exerciseId}`);
          const target = forecast.model.status === "unsupported" || item.calibration ? plannedSet(item, ordinal) : forecast.next;
          checks.missingLoads += Number(!Number.isFinite(target.weightKg));
          checks.belowBarbell += Number(ex.equipment === "barbell" && target.weightKg < 20);
          checks.outOfRange += Number(target.durationSeconds == null && !item.calibration && ex.equipment !== "bodyweight" && forecast.next.action !== "reduce" && forecast.next.action !== "calibrate" && (target.reps < prescription.repsMin || target.reps > prescription.repsMax));
          // Calibration explicitly requires feedback in the real UI; ordinary sets can omit it.
          const actual = response(item.calibration ? { ...person, missingUntil: 0 } : person, ex, day, ordinal, target);
          checks.responseFailures += Number(actual.rir === 0 || actual.technique === "breakdown");
          checks.easyWorkingSets += Number(!item.calibration && actual.rir >= 4);
          entry.sets.push({ target: { weightKg: target.weightKg, reps: target.reps, ...(target.durationSeconds != null ? { durationSeconds: target.durationSeconds } : {}) }, actual,
            calibration: !!item.calibration, action: forecast.next.action, reason: forecast.next.reason });
          await request(`/api/workouts/${workout.id}/sets`, "POST", { exerciseId, ...actual });
          mock.timers.tick(180000);
        }
      }
      await request(`/api/workouts/${workout.id}/finish`, "POST");
      const exported = await exportProgress();
      await parseProgressBackup(exported); await restoreProgress(exported);
      assert.equal((await request(`/api/workouts/${workout.id}`)).totalSets, session.exercises.reduce((n, row) => n + row.sets.length, 0));
    }
    const progress = new Map();
    for (const session of diary) for (const ex of session.exercises) {
      const first = ex.sets[0]; if (!first || first.target.durationSeconds != null) continue;
      const row = progress.get(ex.id) ?? { id: ex.id, name: ex.name, equipment: ex.equipment, exposures: 0, first: first.target, last: first.target, easyFirstSets: 0 };
      row.exposures++; row.last = first.target; row.easyFirstSets += Number(first.actual.rir >= 4); progress.set(ex.id, row);
    }
    for (const row of progress.values()) if (row.exposures >= 3 && row.easyFirstSets >= 3 && row.last.weightKg <= row.first.weightKg && row.last.reps <= row.first.reps) findings.push({ code: "easy-stalled", exerciseId: row.id });
    return { id: person.id, label: person.label, workouts: diary.length, sets: diary.flatMap(w => w.exercises).reduce((n, row) => n + row.sets.length, 0), checks,
      findings, exerciseProgress: [...progress.values()], diary };
  } finally { mock.timers.reset(); }
}

export async function simulateCohort() {
  const people = [];
  for (const person of COHORT) people.push(await simulatePerson(person));
  return { version: 1, days: 28, seed: "fixed-brzycki-response-v1", population: "synthetic healthy adult fixtures", assumptions: [
    "No real people, clinical intervention, observed muscle gain or validated individual prediction.",
    "Capacity growth is an input assumption independent of the planner, not an outcome caused by recommendations.",
    "Hidden Brzycki-style capacity, capped self-reported RIR, within-session fatigue and scripted attendance are stress-test fixtures.",
    "Every workout starts through the actual daily API; live calculation and calibration are followed; backups round-trip after each session.",
  ], people };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const output = resolve(process.argv[2] ?? "../apk/monthly/cohort.json");
  const report = await simulateCohort();
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.people.map(({ id, workouts, sets, checks, findings }) => ({ id, workouts, sets, checks, findings })), null, 2));
}
