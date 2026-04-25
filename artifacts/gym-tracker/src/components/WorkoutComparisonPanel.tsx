import {
  useGetWorkoutComparison,
  getGetWorkoutComparisonQueryKey,
} from "@workspace/api-client-react";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { formatKg, formatNumber } from "@/lib/format";

interface Props {
  workoutId: number;
}

function deltaSign(n: number): "up" | "down" | "flat" {
  if (n > 0.0001) return "up";
  if (n < -0.0001) return "down";
  return "flat";
}

function DeltaPill({
  delta,
  formatFn,
  unit,
}: {
  delta: number;
  formatFn: (n: number) => string;
  unit?: string;
}) {
  const sign = deltaSign(delta);
  const color =
    sign === "up"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : sign === "down"
        ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
        : "text-muted-foreground bg-muted/40 border-border";
  const Icon = sign === "up" ? TrendingUp : sign === "down" ? TrendingDown : Minus;
  const prefix = sign === "up" ? "+" : "";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold tabular-nums ${color}`}
    >
      <Icon className="h-3 w-3" />
      {prefix}
      {formatFn(delta)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

export function WorkoutComparisonPanel({ workoutId }: Props) {
  const { data, isLoading } = useGetWorkoutComparison(workoutId, {
    query: {
      enabled: !!workoutId,
      queryKey: getGetWorkoutComparisonQueryKey(workoutId),
    },
  });

  if (isLoading) return null;
  if (!data || data.previousWorkoutId === null) return null;

  const prevDate = data.previousWorkoutDate
    ? new Date(data.previousWorkoutDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-baseline justify-between px-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Сравнение
        </h2>
        <span className="text-xs text-muted-foreground">
          с {prevDate ?? "пред. трен."}
          {data.previousWorkoutName ? ` · ${data.previousWorkoutName}` : ""}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-2xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Тоннаж
          </div>
          <DeltaPill delta={data.deltaVolume} formatFn={formatKg} />
        </div>
        <div className="bg-card rounded-2xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Повторы
          </div>
          <DeltaPill delta={data.deltaReps} formatFn={formatNumber} />
        </div>
        <div className="bg-card rounded-2xl border border-border p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Подходы
          </div>
          <DeltaPill delta={data.deltaSets} formatFn={(n) => `${n}`} />
        </div>
      </div>

      {data.exercises.length > 0 && (
        <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
          {data.exercises.slice(0, 8).map((ex) => (
            <div key={ex.exerciseId} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm truncate">{ex.name}</span>
                <DeltaPill delta={ex.deltaVolume} formatFn={formatKg} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                <span>
                  Макс: {formatKg(ex.currentMaxWeight)}
                  {ex.previousMaxWeight > 0 ? ` / было ${formatKg(ex.previousMaxWeight)}` : ""}
                </span>
                {ex.deltaMaxWeight !== 0 && (
                  <DeltaPill delta={ex.deltaMaxWeight} formatFn={formatKg} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}
