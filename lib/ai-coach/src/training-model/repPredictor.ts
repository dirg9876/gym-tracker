export function predictReps(strengthKg: number, weightKg: number, targetRir: number, fatigueReps = 0): number | null {
  if (![strengthKg, weightKg, targetRir, fatigueReps].every(Number.isFinite) || strengthKg <= 0 || weightKg <= 0 || targetRir < 0 || fatigueReps < 0) return null;
  return Math.max(0, 30 * (strengthKg / weightKg - 1) - targetRir - fatigueReps);
}
export function predictWeight(strengthKg: number, reps: number, targetRir: number, fatigueReps = 0): number | null {
  if (![strengthKg, reps, targetRir, fatigueReps].every(Number.isFinite) || strengthKg <= 0 || reps < 1 || targetRir < 0 || fatigueReps < 0) return null;
  return strengthKg / (1 + (reps + targetRir + fatigueReps) / 30);
}
export function roundWeightDown(weightKg: number, stepKg: number, minimumKg: number): number | null {
  if (![weightKg, stepKg, minimumKg].every(Number.isFinite) || weightKg < 0 || stepKg <= 0 || minimumKg < 0) return null;
  return Math.round((minimumKg + Math.max(0, Math.floor((weightKg - minimumKg + 1e-8) / stepKg)) * stepKg) * 100) / 100;
}
