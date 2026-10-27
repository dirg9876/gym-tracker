export type StrengthObservation = {
  workoutId: number; workoutStartedAt: string; workoutFinishedAt: string;
  createdAt: string; weightKg: number; reps: number;
  rir?: number | null; technique?: "good" | "breakdown" | null;
  durationSeconds?: number;
};
export const MODEL_ALPHA = 0.2;
const day = 86400000;
export function epleyWithRir(weightKg: number, reps: number, rir: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps < 2 || reps > 10 || !Number.isInteger(rir) || rir < 0 || rir > 3) return null;
  const estimate = weightKg * (1 + (reps + rir) / 30);
  return Number.isFinite(estimate) ? estimate : null;
}
export function qualityEstimate(row: Pick<StrengthObservation, "weightKg" | "reps" | "rir" | "technique" | "durationSeconds">): number | null {
  return row.durationSeconds == null && row.technique === "good" && row.rir != null ? epleyWithRir(row.weightKg, row.reps, row.rir) : null;
}
export function strongestMeasurement<T extends Parameters<typeof qualityEstimate>[0]>(rows: T[]): T | undefined {
  let best: T | undefined, estimate = -Infinity;
  for (const row of rows) {
    const value = qualityEstimate(row);
    if (value != null && value > estimate + 1e-8) { best = row; estimate = value; }
  }
  return best;
}
const median = (values: number[]) => { const sorted = values.slice().sort((a, b) => a - b); const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2; };

// One best valid observation per session avoids both ramp-up bias and back-off fatigue.
export function estimateStrength(rows: StrengthObservation[], now: number) {
  const sessions = new Map<number, StrengthObservation[]>();
  for (const row of rows) {
    const finished = Date.parse(row.workoutFinishedAt), started = Date.parse(row.workoutStartedAt);
    if (!Number.isFinite(finished) || !Number.isFinite(started) || started > finished || finished > now || now - finished > 90 * day) continue;
    const batch = sessions.get(row.workoutId) ?? []; batch.push(row); sessions.set(row.workoutId, batch);
  }
  const ordered = [...sessions.values()].map(batch => batch.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))).sort((a, b) => Date.parse(a[0].workoutFinishedAt) - Date.parse(b[0].workoutFinishedAt) || a[0].workoutId - b[0].workoutId);
  let strength: number | null = null, lastFinished: number | null = null, used = 0;
  const errors: number[] = [], slopes: number[] = [];
  let fatigueSessions = 0;
  for (const batch of ordered) {
    const firstIndex = batch.indexOf(strongestMeasurement(batch)!);
    if (firstIndex < 0) continue;
    const first = batch[firstIndex], finished = Date.parse(first.workoutFinishedAt);
    if (lastFinished != null && finished - lastFinished > 28 * day) { strength = null; used = 0; slopes.length = 0; fatigueSessions = 0; }
    // Walk-forward: never fit a held-out session before measuring its error.
    if (strength != null && lastFinished! < Date.parse(first.workoutStartedAt)) {
      const predicted = Math.max(0, 30 * (strength / first.weightKg - 1) - first.rir!);
      errors.push(Math.abs(first.reps - predicted));
    }
    const observed = qualityEstimate(first)!;
    strength = strength == null ? observed : (1 - MODEL_ALPHA) * strength + MODEL_ALPHA * observed;
    lastFinished = finished; used++;
    const sessionSlopes: number[] = [];
    for (let i = firstIndex + 1; i < batch.length; i++) {
      const row = batch[i];
      if (row.weightKg === first.weightKg && qualityEstimate(row) != null) sessionSlopes.push(Math.max(0, Math.min(3, (first.reps + first.rir! - row.reps - row.rir!) / (i - firstIndex))));
    }
    if (sessionSlopes.length) { fatigueSessions++; slopes.push(...sessionSlopes); }
  }
  return {
    estimated1RMKg: strength, sessions: used, lastFinishedAt: lastFinished == null ? null : new Date(lastFinished).toISOString(),
    stale: lastFinished == null || now - lastFinished > 28 * day,
    validationSamples: errors.length, repErrorMAE: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : null,
    fatigueBeta: slopes.length >= 3 && fatigueSessions >= 2 ? median(slopes) : null, fatigueSamples: slopes.length,
  };
}
