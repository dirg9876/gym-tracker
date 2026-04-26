import { useGetLevelForecast } from "@workspace/api-client-react";
import { Hourglass, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/format";

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
  achieved: "максимум",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  low: "text-amber-400",
  medium: "text-primary",
  high: "text-emerald-400",
  achieved: "text-emerald-400",
};

function formatDays(days: number): string {
  if (days <= 0) return "сегодня";
  if (days === 1) return "1 день";
  if (days < 5) return `${days} дня`;
  if (days < 30) return `${days} дней`;
  if (days < 60) return "около месяца";
  if (days < 365) return `~${Math.round(days / 30)} мес.`;
  return "более года";
}

export function LevelForecastCard() {
  const { data, isLoading } = useGetLevelForecast();

  if (isLoading || !data) return null;

  if (data.confidence === "achieved" || data.nextLevel === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card p-4 rounded-2xl border border-border flex items-center gap-3"
      >
        <Sparkles className="h-6 w-6 text-emerald-400 shrink-0" />
        <div className="text-sm">
          Достигнут максимум прогресса. Поддерживай тоннаж — и оставайся легендой.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card p-4 rounded-2xl border border-border space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-normal text-muted-foreground">
          <Hourglass className="h-3.5 w-3.5 text-primary" />
          <span className="min-w-0 break-words">Прогноз до «{data.nextLevelName}»</span>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-normal ${CONFIDENCE_COLOR[data.confidence]}`}
        >
          {CONFIDENCE_LABEL[data.confidence]}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-primary tabular-nums">
          {data.estimatedDays == null ? "—" : formatDays(data.estimatedDays)}
        </span>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Темп (7 дн., в среднем за день)
          </span>
          <span className="shrink-0 font-mono">{formatNumber(data.avgDailyTonnageKg)} кг</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>За последние 7 дней</span>
          <span className="shrink-0 font-mono">{formatNumber(data.tonnage7dKg)} кг</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="min-w-0">Осталось набрать за окно 7 дн.</span>
          <span className="shrink-0 font-mono">{formatNumber(data.tonnageNeededKg)} кг</span>
        </div>
      </div>

      {data.estimatedDays === null && data.avgDailyTonnageKg <= 0 && (
        <div className="text-xs text-muted-foreground/70 italic">
          Пока нет данных за последние 7 дней — потренируйся, чтобы увидеть прогноз.
        </div>
      )}
    </motion.div>
  );
}
