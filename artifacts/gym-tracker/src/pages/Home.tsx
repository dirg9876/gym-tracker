import { useLocation } from "wouter";
import { useGetActiveWorkout, useGetStatsOverview, useListWorkouts, useCreateWorkout, useGetLevels, getGetActiveWorkoutQueryKey } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { usePageView } from "@/hooks/usePageView";
import { Button } from "@/components/ui/button";
import { formatKg, formatNumber, formatDate } from "@/lib/format";
import { Dumbbell, Activity, Flame, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { levelImage } from "@/lib/tierImages";
import { HomeStrengthCard } from "@/components/HomeStrengthCard";
import gymBeamLogo from "@/assets/gymbeam-logo.png";

export function Home() {
  usePageView("/");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: activeWorkoutResponse, isLoading: isLoadingActive } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const { data: stats, isLoading: isLoadingStats } = useGetStatsOverview();
  const { data: recentWorkouts, isLoading: isLoadingWorkouts } = useListWorkouts({ limit: 3 });
  const { data: levelsData } = useGetLevels();

  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: (newWorkout) => {
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        setLocation(`/workout/${newWorkout.id}`);
      }
    }
  });

  const handleStartWorkout = () => {
    if (activeWorkout) {
      setLocation(`/workout/${activeWorkout.id}`);
    } else {
      createWorkout.mutate({ data: {} });
    }
  };

  const isLoading = isLoadingActive || isLoadingStats || isLoadingWorkouts;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full pt-20 text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Full-width logo banner */}
      <div className="w-full flex flex-col items-center">
        <div className="w-full overflow-hidden" style={{ aspectRatio: "100 / 71" }}>
          <img
            src={gymBeamLogo}
            alt="GYM-BEAM"
            className="w-full h-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <p className="mt-2 mb-3 font-mono font-black tracking-[0.3em] text-sm uppercase select-none">
          <span className="text-primary">LIFT</span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="text-primary">SHINE</span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="text-primary">REPEAT</span>
        </p>
      </div>

      <div className="p-4 space-y-8 pb-24">
        {/* Hero CTA */}
        <section className="mt-2">
          <Button
            className="w-full min-h-20 h-auto py-4 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            onClick={handleStartWorkout}
            disabled={createWorkout.isPending}
          >
            {activeWorkout ? (
              <>
                <Activity className="mr-3 h-6 w-6 animate-pulse" />
                Продолжить тренировку
              </>
            ) : (
              <>
                <Dumbbell className="mr-3 h-6 w-6" />
                Начать тренировку
              </>
            )}
          </Button>
        </section>

        {/* Level card */}
        {levelsData && (() => {
          const cur = levelsData.levels[levelsData.currentLevel];
          const nxt = levelsData.levels[levelsData.currentLevel + 1];
          const nxtTarget = levelsData.nextLevelTonnage7dKgRequired ?? 0;
          const tonProg = nxt && nxtTarget > 0
            ? Math.min(100, (levelsData.stats.currentTonnageSinceLevelUp / nxtTarget) * 100)
            : 100;
          return (
            <button
              onClick={() => setLocation('/levels')}
              className="w-full bg-card p-4 rounded-2xl border border-border active:bg-accent transition-colors text-left flex items-center gap-3"
            >
              <img
                src={levelImage(cur.level, cur.tier, levelsData.sex)}
                alt=""
                className="h-14 w-14 object-contain shrink-0 drop-shadow-[0_0_12px_rgba(255,80,40,0.25)]"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono text-primary">LVL {cur.level}</span>
                  <span className="font-bold truncate">{cur.name}</span>
                </div>
                {nxt ? (
                  <>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      До «{nxt.name}»: {formatNumber(levelsData.stats.currentTonnageSinceLevelUp)} / {formatNumber(nxtTarget)} кг
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                      <div className="h-full bg-primary transition-all" style={{ width: `${tonProg}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground mt-0.5">Максимальный уровень</div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })()}

        {/* Quick Stats */}
        {stats && (
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold uppercase tracking-normal">Серия</span>
              </div>
              <div className="text-2xl font-black">{stats.currentStreakDays} <span className="text-sm font-medium text-muted-foreground">дней</span></div>
            </div>
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-normal">Тоннаж</span>
              </div>
              <div className="text-2xl font-black">{formatKg(stats.totalVolume)}</div>
            </div>
          </section>
        )}

        {/* Strength progress for top exercise */}
        <HomeStrengthCard />

        {/* Recent Workouts */}
        {recentWorkouts && recentWorkouts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Последние тренировки</h2>
              <Button variant="ghost" size="sm" className="text-primary h-8 px-2" onClick={() => setLocation('/history')}>
                Все <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {recentWorkouts.map(workout => (
                <div
                  key={workout.id}
                  className="bg-card p-4 rounded-2xl border border-border active:bg-accent transition-colors"
                  onClick={() => setLocation(`/history/${workout.id}`)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="font-semibold">{workout.name || "Тренировка"}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(workout.startedAt)}</div>
                  </div>
                  <div className="flex gap-4 text-sm font-medium">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase block">Объем</span>
                      {formatKg(workout.totalVolume)}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase block">Повторы</span>
                      {formatNumber(workout.totalReps)}
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase block">Упражнения</span>
                      {workout.exerciseCount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
