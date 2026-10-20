import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { storage, request } from "./testHarness.mjs";
const { exportProgress } = await import("../lib/progressBackup.ts");

// Synthetic fixture only. Import exclusively into gymbeam_visualqa, never the user's AVD.
storage.clear();
const create = name => request("/api/exercises", "POST", { name, muscleGroup: "Грудь", equipment: "dumbbell" });
const legacy = await create("Legacy press");
const alias = await create("Alias press");
const unused = await create("Unused fixture");
const completed = await request("/api/workouts", "POST");
await request(`/api/workouts/${completed.id}/sets`, "POST", { exerciseId: legacy.id, weightKg: 10, reps: 12, rir: 3, technique: "good" });
await request(`/api/workouts/${completed.id}/finish`, "POST");
const row = (exerciseId, weightKg) => ({ exerciseId, sets: 1, repsMin: 10, repsMax: 10, intent: "hypertrophy", setTargets: [{ weightKg, reps: 10 }] });
const program = await request("/api/programs", "POST", { name: "Replacement QA", exercises: [row(alias.id, 12.5), row(3, 15)] });
const active = await request("/api/workouts", "POST", { programId: program.id });
await request(`/api/workouts/${active.id}/draft`, "PUT", { revision: 0, draft: { exerciseId: alias.id, weightKg: 12.5, reps: 10, rir: 2, technique: "good" } });
await request(`/api/workouts/${active.id}/draft/commit`, "POST", { revision: 1 });
const backup = JSON.parse(await exportProgress());
for (const ex of backup.state.exercises.filter(ex => [legacy.id, unused.id].includes(ex.id))) ex.deletedAt = new Date().toISOString();
backup.checksum = createHash("sha256").update(JSON.stringify({ state: backup.state, plans: backup.plans })).digest("hex");
const file = resolve(process.argv[2] ?? "../apk/verified/release-1.1.7-synthetic-legacy.json");
await writeFile(file, JSON.stringify(backup, null, 2));
console.log(JSON.stringify({ file, legacyId: legacy.id, aliasId: alias.id, unusedId: unused.id, completedWorkoutId: completed.id, activeWorkoutId: active.id, fixtureOnly: true }));
