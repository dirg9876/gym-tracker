import fs from "node:fs";
import path from "node:path";
import { request } from "./testHarness.mjs";

const { restoreProgress, exportProgress } = await import("../lib/progressBackup.ts");
const [source, destination] = process.argv.slice(2);
if (!source || !destination || path.resolve(source) === path.resolve(destination)) {
  throw new Error("Usage: node scripts/create-safety-qa.mjs <original-backup> <separate-qa-output>");
}
await restoreProgress(fs.readFileSync(source, "utf8"));
if ((await request("/api/workouts/active")).workout) throw new Error("Use a fixture without an active workout; never delete the user's draft.");
const program = await request("/api/programs", "POST", {
  name: "Safety QA", exercises: [{
    exerciseId: 1, sets: 2, repsMin: 10, repsMax: 10, intent: "hypertrophy",
    setTargets: [{ weightKg: 20, reps: 10 }, { weightKg: 20, reps: 10 }],
  }],
});
const workout = await request("/api/workouts", "POST", { programId: program.id });
fs.writeFileSync(destination, await exportProgress());
console.log(JSON.stringify({ programId: program.id, activeId: workout.id, output: destination }));
