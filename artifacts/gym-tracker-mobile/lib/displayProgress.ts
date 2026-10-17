export function progressRatio(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
}

export function countdownLabel(remainingMilliseconds: number): string {
  const seconds = Number.isFinite(remainingMilliseconds) ? Math.max(0, Math.ceil(remainingMilliseconds / 1000)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
