import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import type { WorkoutExerciseBreakdownItem } from "@workspace/api-client-react";
import { formatKg, formatNumber, formatDate } from "@/lib/format";

function DeltaTag({
  value,
  format,
  invertColors = false,
}: {
  value: number | null;
  format: (n: number) => string;
  invertColors?: boolean;
}) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">— впервые</span>;
  }
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0</span>
      </span>
    );
  }
  const positive = invertColors ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  const color = positive ? "text-emerald-500" : "text-rose-500";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{sign}{format(value)}</span>
    </span>
  );
}

interface Props {
  item: WorkoutExerciseBreakdownItem;
}

export function ExerciseProgressCard({ item }: Props) {
  const hasPrev = item.previousSessionDate !== null;

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-3 border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight">{item.exerciseName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.muscleGroup}
          </div>
        </div>
        {item.isPersonalRecord && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground rounded-full px-2 py-1 shrink-0">
            <Trophy className="h-3 w-3" />
            <span>PR</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border">
        <Cell
          label="Тоннаж"
          value={formatKg(item.volume)}
          delta={
            <DeltaTag value={item.deltaVolume} format={(v) => formatKg(Math.abs(v))} />
          }
        />
        <Cell
          label="Топ-сет"
          value={`${formatKg(item.topSetWeight)} × ${item.topSetReps}`}
          delta={
            <DeltaTag
              value={item.deltaTopWeight}
              format={(v) => formatKg(Math.abs(v))}
            />
          }
        />
        <Cell
          label="Повторы"
          value={formatNumber(item.reps)}
          delta={
            <DeltaTag value={item.deltaReps} format={(v) => formatNumber(Math.abs(v))} />
          }
        />
      </div>

      <div className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/30">
        {hasPrev ? (
          <>
            Сравнение с{" "}
            {item.previousSessionWorkoutName
              ? `«${item.previousSessionWorkoutName}»`
              : "прошлой тренировкой"}{" "}
            от {formatDate(item.previousSessionDate as string)}
          </>
        ) : (
          <>Первое упражнение в истории — будем сравнивать в следующий раз.</>
        )}
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: React.ReactNode;
}) {
  return (
    <div className="p-3 flex flex-col items-center text-center gap-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono font-bold text-sm">{value}</div>
      <div>{delta}</div>
    </div>
  );
}
