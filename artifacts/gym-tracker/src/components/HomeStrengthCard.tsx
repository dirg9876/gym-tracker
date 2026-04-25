import {
  useGetStatsOverview,
  useGetExerciseProgress,
  getGetExerciseProgressQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { ChevronRight, TrendingUp } from "lucide-react";
import { ProgressLineChart } from "@/components/charts/ProgressLineChart";
import { formatKg } from "@/lib/format";

export function HomeStrengthCard() {
  const [, setLocation] = useLocation();
  const { data: stats } = useGetStatsOverview();
  const top = stats?.topExercises[0];
  const topId = top?.exerciseId;

  const { data: progress } = useGetExerciseProgress(topId ?? 0, {
    query: {
      enabled: !!topId,
      queryKey: getGetExerciseProgressQueryKey(topId ?? 0),
    },
  });

  if (!top || !progress || progress.points.length < 2) return null;

  const currentMax = progress.points.reduce(
    (m, p) => Math.max(m, p.maxWeight),
    0,
  );
  const firstMax = progress.points[0]!.maxWeight;
  const delta = currentMax - firstMax;

  return (
    <section
      className="bg-card p-4 rounded-3xl border border-border space-y-3 active:bg-accent transition-colors cursor-pointer"
      onClick={() => setLocation(`/exercises/${top.exerciseId}`)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary" />
            Прогресс силы · {top.muscleGroup}
          </div>
          <div className="font-bold truncate">{top.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-2xl font-black text-primary tabular-nums">
            {formatKg(currentMax)}
          </div>
          {delta !== 0 && (
            <div
              className={`text-[11px] font-bold tabular-nums ${
                delta > 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {formatKg(delta)} от старта
            </div>
          )}
        </div>
      </div>
      <div className="-mx-2">
        <div className="h-40">
          <ProgressLineChart
            data={progress.points}
            dataKey="maxWeight"
            color="hsl(var(--primary))"
            formatValue={formatKg}
          />
        </div>
      </div>
      <div className="flex items-center justify-end text-xs text-primary">
        Подробнее <ChevronRight className="h-3 w-3" />
      </div>
    </section>
  );
}
