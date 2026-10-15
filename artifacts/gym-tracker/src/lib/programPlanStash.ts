import type { ProgramPlan } from "@workspace/api-client-react";

const PREFIX = "gym-tracker:program-plan:";
const ADAPTIVE_PREFIX = "gym-tracker:adaptive-plan:";

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

export function saveAdaptivePlan(programId: string, plan: ProgramPlan): void {
  try {
    localStorage.setItem(`${ADAPTIVE_PREFIX}${programId}`, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

export function loadAdaptivePlan(programId: string): ProgramPlan | null {
  try {
    const raw = localStorage.getItem(`${ADAPTIVE_PREFIX}${programId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProgramPlan;
  } catch {
    return null;
  }
}
