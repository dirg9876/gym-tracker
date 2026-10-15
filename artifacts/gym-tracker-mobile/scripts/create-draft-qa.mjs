import fs from "node:fs";
import path from "node:path";
import { request } from "./testHarness.mjs";

const { restoreProgress, exportProgress } = await import("../lib/progressBackup.ts");
const [source, destination] = process.argv.slice(2);
if (!source || !destination || path.resolve(source) === path.resolve(destination)) throw new Error("Usage: create-draft-qa.mjs <original-backup> <separate-qa-output>");
await restoreProgress(fs.readFileSync(source, "utf8"));
if ((await request("/api/workouts/active")).workout) throw new Error("Original progress has an active workout; do not replace the user's draft.");
const program = await request("/api/programs", "POST", {
  name: "Draft QA", exercises: [
    { exerciseId: 1, sets: 2, repsMin: 8, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg: 20, reps: 10 }, { weightKg: 22.5, reps: 8 }] },
    { exerciseId: 30, sets: 1, repsMin: 45, repsMax: 45, intent: "accessory", setTargets: [{ weightKg: 0, reps: 0, durationSeconds: 45 }] },
  ],
});
const workout = await request("/api/workouts", "POST", { programId: program.id });
fs.writeFileSync(destination, await exportProgress());
console.log(JSON.stringify({ programId: program.id, activeId: workout.id, output: destination }));
