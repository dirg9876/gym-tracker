import type { ProgramPlan } from "@workspace/api-client-react";

const PREFIX = "gym-tracker:program-plan:";

export function savePlan(workoutId: number, plan: ProgramPlan): void {
  try {
    localStorage.setItem(`${PREFIX}${workoutId}`, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

export function loadPlan(workoutId: number): ProgramPlan | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${workoutId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProgramPlan;
  } catch {
    return null;
  }
}

export function clearPlan(workoutId: number): void {
  try {
    localStorage.removeItem(`${PREFIX}${workoutId}`);
  } catch {
    // ignore
  }
}
