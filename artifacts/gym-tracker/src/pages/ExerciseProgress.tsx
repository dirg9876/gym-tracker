import { useParams, useLocation } from "wouter";
import {
  useGetExerciseProgress,
  useGetExerciseNorms,
  getGetExerciseProgressQueryKey,
  getGetExerciseNormsQueryKey,
  type SportRank,
  type ExerciseRankNorms,
} from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLineChart } from "@/components/charts/ProgressLineChart";
import { formatKg, formatNumber } from "@/lib/format";
import { RankBadge } from "@/components/RankBadge";

function RankLadder({
  norms,
  maxWeight,
}: {
  norms: ExerciseRankNorms;
  maxWeight: number;
}) {
  const { rankNorms, currentRank, nextRank, kgToNextRank, mcKg } = norms;

  if (mcKg == null) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        Упражнение на время — разряды по кг не применяются
      </div>
    );
  }

  if (maxWeight === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">
        Зафиксируй результат, чтобы увидеть свой разряд
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current rank hero + delta to next */}
      <div className="flex flex-wrap items-center gap-2">
        {currentRank ? (
          <RankBadge rank={currentRank} variant="hero" />
        ) : (
          <span className="text-sm text-muted-foreground">Нет разряда</span>
        )}
        {nextRank && kgToNextRank != null && (
          <span className="break-words text-xs text-muted-foreground">
            до {nextRank.shortLabel}: +{formatKg(kgToNextRank)}
          </span>
        )}
        {!nextRank && currentRank?.code === "MSMC" && (
          <span className="text-xs text-primary font-medium">Норматив МСМК выполнен!</span>
        )}
      </div>

      {/* 9-row rank ladder (МС → Б/Р) */}
      <div className="space-y-0.5">
        {[...rankNorms].reverse().map((entry) => {
          const isCurrentRank = currentRank?.code === entry.rank.code;
          const isNextRank = nextRank?.code === entry.rank.code;
          const passed = maxWeight >= entry.kgTarget && entry.kgTarget > 0;
          return (
            <div
              key={entry.rank.code}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                isCurrentRank
                  ? "bg-primary/15 border border-primary/30 font-semibold"
                  : isNextRank
                    ? "bg-muted/30 border border-dashed border-primary/20"
                    : "border border-transparent"
              }`}
            >
              <RankBadge rank={entry.rank} variant="compact" />
              <div className="flex items-center gap-2">
                {entry.kgTarget === 0 ? (
                  <span className="text-muted-foreground/60 text-[10px]">старт</span>
                ) : (
                  <>
                    <span className={`font-mono ${passed ? "text-primary" : "text-muted-foreground"}`}>
                      {formatKg(entry.kgTarget)}
                    </span>
                    {isNextRank && kgToNextRank != null && (
                      <span className="text-[10px] text-muted-foreground/70">
                        (+{formatKg(kgToNextRank)})
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-muted-foreground/60 text-center">
        Норматив МСМК: {formatKg(mcKg)}
      </div>
    </div>
  );
}

export function ExerciseProgress() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: progress, isLoading } = useGetExerciseProgress(id, {
    query: { enabled: !!id, queryKey: getGetExerciseProgressQueryKey(id) },
  });

  const { data: normsData } = useGetExerciseNorms(id, {
    query: { enabled: !!id, queryKey: getGetExerciseNormsQueryKey(id) },
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!progress) return <div className="p-8 text-center">Упражнение не найдено</div>;

  const { exercise, points } = progress;
  const maxWeight = points.length > 0 ? Math.max(...points.map((p) => p.maxWeight)) : 0;
  const maxVolume = points.length > 0 ? Math.max(...points.map((p) => p.volume)) : 0;
  const maxReps = points.length > 0 ? Math.max(...points.map((p) => p.reps)) : 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="break-words font-bold text-lg leading-tight">{exercise.name}</h1>
            <div className="break-words text-xs text-primary font-bold uppercase tracking-normal">
              {exercise.muscleGroup}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 mt-4">
        {/* PR records */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Макс. Вес</div>
            <div className="break-words font-mono text-base font-black leading-tight text-primary">{formatKg(maxWeight)}</div>
          </div>
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Рекорд Объема</div>
            <div className="break-words font-mono text-base font-black leading-tight">{formatKg(maxVolume)}</div>
          </div>
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Макс. Повторов</div>
            <div className="break-words font-mono text-base font-black leading-tight">{formatNumber(maxReps)}</div>
          </div>
        </div>

        {/* Rank ladder */}
        {normsData && (
          <section className="bg-card p-4 rounded-3xl border border-border">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Спортивный разряд
            </h2>
            <RankLadder norms={normsData} maxWeight={maxWeight} />
          </section>
        )}

        {points.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Нет данных о тренировках
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-card p-4 rounded-3xl border border-border">
              <h2 className="font-bold text-lg mb-6 ml-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Максимальный вес
              </h2>
              <ProgressLineChart
                data={points}
                dataKey="maxWeight"
                color="hsl(var(--chart-1))"
                formatValue={formatKg}
              />
            </section>

            <section className="bg-card p-4 rounded-3xl border border-border">
              <h2 className="font-bold text-lg mb-6 ml-2">Объем за тренировку</h2>
              <ProgressLineChart
                data={points}
                dataKey="volume"
                color="hsl(var(--chart-2))"
                formatValue={formatKg}
              />
            </section>

            <section>
              <h2 className="font-bold text-lg mb-4 ml-2">Лучшие подходы (история)</h2>
              <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
                {[...points].reverse().map((point) => (
                  <div
                    key={point.workoutId}
                    className="p-4 flex justify-between items-center gap-3 hover:bg-accent cursor-pointer"
                    onClick={() => setLocation(`/history/${point.workoutId}`)}
                  >
                    <div className="shrink-0 text-sm text-muted-foreground">
                      {new Date(point.date).toLocaleDateString("ru-RU")}
                    </div>
                    <div className="min-w-0 break-words text-right font-mono font-bold text-base leading-tight">
                      {formatKg(point.topSet.weightKg)}{" "}
                      <span className="text-muted-foreground mx-1 font-sans text-sm">×</span>{" "}
                      {point.topSet.reps}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
