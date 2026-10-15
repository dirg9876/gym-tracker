import {
  useGetStatsOverview,
  useGetProgress,
  useListWorkouts,
  useDeleteWorkout,
  getListWorkoutsQueryKey,
  getGetLevelsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { usePageView } from "@/hooks/usePageView";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressLineChart } from "@/components/charts/ProgressLineChart";
import { MuscleGroupBarChart } from "@/components/charts/MuscleGroupBarChart";
import { HeatmapCalendar } from "@/components/HeatmapCalendar";
import { formatKg, formatNumber, formatDate } from "@/lib/format";
import { TrendingUp, Dumbbell, Award, Weight, Clock, ChevronRight, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function Stats() {
  usePageView("/stats");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const { data: stats, isLoading: isStatsLoading } = useGetStatsOverview();
  const { data: progress, isLoading: isProgressLoading } = useGetProgress();
  const { data: workouts, isLoading: isWorkoutsLoading } = useListWorkouts({ limit: 50 });

  const deleteWorkout = useDeleteWorkout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        setPendingDeleteId(null);
      },
    },
  });

  if (isStatsLoading || isProgressLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  if (!stats || !progress)
    return (
      <AppShell>
        <div className="p-8 text-muted-foreground">Нет данных</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="p-4 space-y-8 pb-20">
        <h1 className="text-3xl font-black mt-4">Статистика</h1>

        {/* Key records */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1">
            Личные рекорды
          </h2>

          {/* Best tonnage — full width hero */}
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-normal">
                Лучший тоннаж за тренировку
              </span>
            </div>
            <div className="glitch-num break-words text-3xl font-black leading-tight text-primary">
              {formatKg(stats.bestTonnage)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              сумма (вес × повторы) за одну сессию
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Weight className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-xs font-semibold uppercase tracking-normal">Макс. вес</span>
              </div>
              <div className="glitch-num break-words text-xl font-black leading-tight">
                {formatKg(stats.bestMaxWeight)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">в одном подходе</div>
            </div>

            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Award className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-normal">
                  Рекорд повторов
                </span>
              </div>
              <div className="glitch-num break-words text-xl font-black leading-tight">
                {formatNumber(stats.bestReps)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">за тренировку</div>
            </div>

            <div className="bg-card p-4 rounded-2xl border border-border col-span-2">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Dumbbell className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-normal">Тренировки</span>
              </div>
              <div className="flex items-baseline gap-3">
                <div className="glitch-num break-words text-xl font-black leading-tight">
                  {stats.totalWorkouts}
                </div>
                {stats.weekWorkouts > 0 && (
                  <div className="text-sm text-primary font-semibold">
                    +{stats.weekWorkouts} на этой неделе
                  </div>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">за всё время</div>
            </div>
          </div>
        </section>

        {/* Heatmap */}
        <HeatmapCalendar />

        {/* History section */}
        <section className="space-y-3">
          <button
            className="w-full flex items-center justify-between bg-card border border-border rounded-2xl p-4 active:bg-accent transition-colors"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-bold">История тренировок</div>
                {!isWorkoutsLoading && workouts && workouts.length > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {workouts.length} тренировок сохранено
                  </div>
                )}
              </div>
            </div>
            {historyOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {historyOpen && (
            <div className="space-y-3">
              {isWorkoutsLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">Загрузка...</div>
              ) : !workouts || workouts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Нет тренировок
                </div>
              ) : (
                workouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="bg-card p-4 rounded-2xl border border-border cursor-pointer hover:border-primary/50 active:bg-accent transition-colors"
                    onClick={() => setLocation(`/history/${workout.id}`)}
                  >
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <h3 className="font-bold flex-1 truncate">{workout.name || "Тренировка"}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          {formatDate(workout.startedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          disabled={deleteWorkout.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(workout.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-background rounded-lg p-2 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                          Тоннаж
                        </div>
                        <div className="font-mono font-bold text-sm">{formatKg(workout.totalVolume)}</div>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                          Повторы
                        </div>
                        <div className="font-mono font-bold text-sm">{formatNumber(workout.totalReps)}</div>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                          Подходы
                        </div>
                        <div className="font-mono font-bold text-sm">{workout.totalSets}</div>
                      </div>
                    </div>

                    {workout.topExercises.length > 0 && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {workout.topExercises.join(" • ")}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Charts */}
        {progress.points.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1">
              Динамика
            </h2>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="mb-1 ml-2">
                <h3 className="font-bold text-base">Тоннаж по тренировкам</h3>
                <p className="text-[11px] text-muted-foreground">кг за сессию (вес × повторы)</p>
              </div>
              <div className="mt-4">
                <ProgressLineChart
                  data={progress.points}
                  dataKey="volume"
                  color="hsl(var(--chart-1))"
                  formatValue={formatKg}
                />
              </div>
            </div>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="mb-1 ml-2">
                <h3 className="font-bold text-base">Максимальный вес</h3>
                <p className="text-[11px] text-muted-foreground">
                  лучший подход за тренировку, кг
                </p>
              </div>
              <div className="mt-4">
                <ProgressLineChart
                  data={progress.points}
                  dataKey="maxWeight"
                  color="hsl(var(--chart-2))"
                  formatValue={formatKg}
                />
              </div>
            </div>
          </section>
        )}

        {/* Muscle Groups */}
        {stats.muscleGroupVolume.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground ml-1">
              Нагрузка по мышцам
            </h2>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="mb-1 ml-2">
                <h3 className="font-bold text-base">Объём по группам</h3>
                <p className="text-[11px] text-muted-foreground">суммарный тоннаж за всё время</p>
              </div>
              <div className="mt-4">
                <MuscleGroupBarChart data={stats.muscleGroupVolume} />
              </div>
            </div>
          </section>
        )}

        {/* Top Exercises */}
        {stats.topExercises.length > 0 && (
          <section className="space-y-4">
            <div className="ml-1">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Топ упражнений
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">по суммарному тоннажу</p>
            </div>
            <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
              <div className="px-4 py-2.5 flex items-center gap-4 text-[10px] uppercase font-semibold tracking-widest text-muted-foreground">
                <div className="w-6" />
                <div className="flex-1">Упражнение</div>
                <div className="text-right shrink-0">
                  <div>Тоннаж</div>
                  <div>Макс. вес</div>
                </div>
              </div>
              {stats.topExercises.map((ex, i) => (
                <div
                  key={ex.exerciseId}
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent active:bg-accent transition-colors"
                  onClick={() => setLocation(`/exercises/${ex.exerciseId}`)}
                >
                  <div className="w-6 font-black text-muted-foreground text-lg shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-bold leading-tight">{ex.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ex.muscleGroup} · {ex.sets} подх.
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono font-bold text-sm text-primary tabular-nums">
                      {formatKg(ex.volume)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                      {formatKg(ex.maxWeightKg)} макс.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
            <AlertDialogDescription>
              Тренировка и все её подходы будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWorkout.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteWorkout.isPending}
              onClick={() => {
                if (pendingDeleteId !== null) {
                  deleteWorkout.mutate({ workoutId: pendingDeleteId });
                }
              }}
            >
              {deleteWorkout.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                "Удалить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
