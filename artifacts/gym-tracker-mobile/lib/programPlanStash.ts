import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProgramPlan } from "@workspace/api-client-react";

const PREFIX = "gym-tracker:program-plan:";

export async function savePlan(workoutId: number, plan: ProgramPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PREFIX}${workoutId}`, JSON.stringify(plan));
  } catch {
    // Storage may be unavailable; not fatal.
  }
}

export async function loadPlan(workoutId: number): Promise<ProgramPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFIX}${workoutId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProgramPlan;
  } catch {
    return null;
  }
}

export async function clearPlan(workoutId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PREFIX}${workoutId}`);
  } catch {
    // ignore
  }
}
