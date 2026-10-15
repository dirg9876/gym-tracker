import fs from "node:fs";
import { request } from "./testHarness.mjs";
const { restoreProgress, exportProgress } = await import("../lib/progressBackup.ts");
const { clearPlan } = await import("../lib/programPlanStash.ts");
const [source, destination] = process.argv.slice(2);
if (!source || !destination || source === destination) throw new Error("Usage: node scripts/create-coach-qa.mjs <original-backup> <separate-qa-output>");
await request("/api/profile");
await restoreProgress(fs.readFileSync(source, "utf8"));
const active = (await request("/api/workouts/active")).workout;
if (active) await request(`/api/workouts/${active.id}`, "DELETE");
const program = await request("/api/programs", "POST", { name: "Coach QA", exercises: [
  { exerciseId: 1, sets: 4, repsMin: 8, repsMax: 12, intent: "hypertrophy", weightStepKg: 2.5, targetRir: 2, setTargets: [
    { weightKg: 20, reps: 10, setType: "warmup" },
    ...Array.from({ length: 3 }, () => ({ weightKg: 40, reps: 12, setType: "working" })),
  ] },
  { exerciseId: 30, sets: 1, repsMin: 30, repsMax: 30, intent: "accessory", setTargets: [{ weightKg: 0, reps: 0, durationSeconds: 30, setType: "working" }] },
] });
const previous = await request("/api/workouts", "POST", { programId: program.id });
await request(`/api/workouts/${previous.id}/sets`, "POST", { exerciseId: 1, weightKg: 20, reps: 10, setType: "warmup" });
for (let i = 0; i < 3; i++) await request(`/api/workouts/${previous.id}/sets`, "POST", { exerciseId: 1, weightKg: 40, reps: 12, setType: "working", rir: 2, technique: "good" });
await request(`/api/workouts/${previous.id}/sets`, "POST", { exerciseId: 30, weightKg: 0, reps: 0, durationSeconds: 30, setType: "working", technique: "good" });
await request(`/api/workouts/${previous.id}/finish`, "POST");
await clearPlan(previous.id);
const next = await request("/api/workouts", "POST", { programId: program.id });
fs.writeFileSync(destination, await exportProgress());
console.log(JSON.stringify({ programId: program.id, completedId: previous.id, activeId: next.id, output: destination }));
