import {
  useGetExerciseLastSets,
  getGetExerciseLastSetsQueryKey,
} from "@workspace/api-client-react";
import { History, Trophy, Repeat } from "lucide-react";
import { motion } from "framer-motion";
import { formatKg } from "@/lib/format";

interface PreviousSetsProps {
  exerciseId: number;
  onRepeatLast?: (weightKg: number, reps: number) => void;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function PreviousSets({ exerciseId, onRepeatLast }: PreviousSetsProps) {
  const { data, isLoading } = useGetExerciseLastSets(exerciseId, {
    query: {
      enabled: !!exerciseId,
      queryKey: getGetExerciseLastSetsQueryKey(exerciseId),
    },
  });

  if (isLoading || !data || data.sets.length === 0) return null;

  const lastSet = data.sets[data.sets.length - 1]!;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/60 p-4 rounded-2xl border border-border/60 space-y-3"
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-bold uppercase tracking-wider">
          <History className="h-3.5 w-3.5" />
          Прошлая тренировка
        </div>
        {data.workoutDate && (
          <span className="text-muted-foreground/70">
            {formatRelativeDate(data.workoutDate)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {data.sets.map((s, i) => (
          <div
            key={i}
            className="px-2.5 py-1.5 rounded-lg bg-muted/40 font-mono text-sm font-bold tabular-nums"
          >
            {formatKg(s.weightKg)} <span className="text-muted-foreground text-xs">×</span> {s.reps}
          </div>
        ))}
      </div>

      {data.bestEverWeightKg != null && data.bestEverReps != null && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400">
          <Trophy className="h-3.5 w-3.5" />
          Личный максимум: {formatKg(data.bestEverWeightKg!)} × {data.bestEverReps}
        </div>
      )}

      {onRepeatLast && (
        <button
          type="button"
          onClick={() => onRepeatLast(lastSet.weightKg, lastSet.reps)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/20 transition-colors active:scale-95"
        >
          <Repeat className="h-3.5 w-3.5" />
          Повторить: {formatKg(lastSet.weightKg)} × {lastSet.reps}
        </button>
      )}
    </motion.div>
  );
}
