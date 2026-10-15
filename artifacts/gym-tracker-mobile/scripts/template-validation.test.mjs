import assert from "node:assert/strict";
import { test } from "node:test";
import "./testHarness.mjs";
const { templateInputErrors, templateInputSchema, validateTargets } = await import("../lib/workoutTemplates.ts");

const bench = () => ({ exerciseId: 1, name: "Bench", equipment: "barbell", sets: 1, repsMin: 8, repsMax: 12, intent: "hypertrophy", weightStepKg: 2.5, targetRir: 2, setTargets: [{ weightKg: 20, reps: 8 }] });
const plan = ex => ({ name: "A", exercises: [ex ?? bench()] });

test("empty name does not blame correct weights and empty exercise list has its own error", () => {
  assert.deepEqual(Object.keys(templateInputErrors({ ...plan(), name: "  " })), ["name"]);
  assert.deepEqual(Object.keys(templateInputErrors({ name: "A", exercises: [] })), ["exercises"]);
  assert.deepEqual(templateInputErrors(plan()), {});
});

test("invalid progression points to the specific field", () => {
  for (const [field, value] of [["repsMin", 0], ["repsMax", 7], ["weightStepKg", 0], ["weightStepKg", 21], ["targetRir", 1.5], ["targetRir", 6]]) {
    const input = plan({ ...bench(), [field]: value });
    assert.equal(templateInputSchema.safeParse(input).success, false);
    assert.deepEqual(Object.keys(templateInputErrors(input)), [`exercises.0.${field}`]);
  }
});

test("barbell minimum and invalid repetitions identify their set fields", () => {
  for (const [field, value] of [["weightKg", 2.5], ["weightKg", NaN], ["reps", 0], ["reps", 1.5], ["reps", NaN]]) {
    const ex = bench();
    ex.setTargets[0][field] = value;
    assert.equal(validateTargets(ex, ex.setTargets), false);
    assert.deepEqual(Object.keys(templateInputErrors(plan(ex))), [`exercises.0.setTargets.0.${field}`]);
  }
});

test("time-based exercise errors refer to seconds, not weight", () => {
  const plank = { ...bench(), name: "\u041f\u043b\u0430\u043d\u043a\u0430", equipment: "bodyweight", setTargets: [{ weightKg: 0, reps: 0, durationSeconds: 30 }] };
  assert.deepEqual(templateInputErrors(plan(plank)), {});
  for (const seconds of [0, 1.5, 86401, NaN]) {
    const ex = { ...plank, setTargets: [{ ...plank.setTargets[0], durationSeconds: seconds }] };
    assert.deepEqual(Object.keys(templateInputErrors(plan(ex))), ["exercises.0.setTargets.0.durationSeconds"]);
  }
});

test("duplicate exercises and inconsistent target counts point to the conflicting row", () => {
  assert.deepEqual(Object.keys(templateInputErrors({ name: "A", exercises: [bench(), bench()] })), ["exercises.1.exerciseId"]);
  assert.deepEqual(Object.keys(templateInputErrors(plan({ ...bench(), sets: 2 }))), ["exercises.0.setTargets"]);
});

test("form and shared validation agree for valid weight/time boundary values", () => {
  for (const equipment of ["barbell", "dumbbell", "machine", "bodyweight", "other"]) for (const weightKg of [0, 2.5, 20, 100]) {
    const ex = { ...bench(), equipment, setTargets: [{ weightKg, reps: 8 }] };
    assert.equal(Object.keys(templateInputErrors(plan(ex))).length === 0, templateInputSchema.safeParse(plan(ex)).success && validateTargets(ex, ex.setTargets));
  }
});
