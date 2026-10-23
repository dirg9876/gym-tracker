import type { ExerciseOutlook } from "./exerciseOutlook";
import type { InsightExercise, InsightPoint, InsightSeries } from "./trainingInsights";

export type ExerciseTimelinePoint = (InsightPoint & { kind: "history" }) | {
  kind: "forecast"; date: string; value: number; session: ExerciseOutlook["sessions"][number];
};

export function buildExerciseTimeline(outlook: ExerciseOutlook, history?: InsightExercise, preferredMetric?: InsightSeries["id"] | null) {
  const supported: InsightSeries["id"][] = outlook.timed ? ["seconds"] : outlook.assisted ? ["assistance", "reps"]
    : outlook.exercise.equipment === "bodyweight" ? ["reps", ...(outlook.sessions.some(row => row.targets.some(set => set.weightKg > 0)) ? ["weight" as const] : [])] : ["weight", "reps"];
  const definitions = {
    weight: { id: "weight", label: outlook.exercise.equipment === "dumbbell" ? "Вес одной гантели" : outlook.exercise.equipment === "bodyweight" ? "Дополнительный вес" : "Вес подхода", unit: "kg" },
    assistance: { id: "assistance", label: "Противовес", unit: "kg" },
    reps: { id: "reps", label: "Повторы за один подход", unit: "reps" },
    seconds: { id: "seconds", label: "Время удержания", unit: "seconds" },
  } as const;
  const ids = new Set([...(history?.series.map(row => row.id) ?? []), ...supported]);
  const metrics = [...ids].map(id => definitions[id]);
  const metric = metrics.find(row => row.id === (preferredMetric ?? history?.defaultMetric ?? supported[0])) ?? metrics[0];
  const measured = history?.series.find(row => row.id === metric.id)?.points ?? [];
  const points: ExerciseTimelinePoint[] = measured.map(point => ({ ...point, kind: "history" }));
  if (!outlook.calibration && supported.includes(metric.id)) for (const session of outlook.sessions) {
    const set = session.targets[0];
    if (set) points.push({ kind: "forecast", date: `${session.date}T12:00:00`, session,
      value: metric.id === "seconds" ? set.durationSeconds ?? 0 : metric.id === "reps" ? set.reps : set.weightKg });
  }
  points.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return { metrics, metric, points, forecastStartIndex: points.findIndex(point => point.kind === "forecast"),
    minimumSpan: metric.unit === "kg" ? (outlook.weightStepKg ?? 2.5) * 2 : metric.unit === "seconds" ? 5 : 1 };
}
