import { useLocation } from "wouter";
import { useGetActiveWorkout, useGetStatsOverview, useListWorkouts, useCreateWorkout, getGetActiveWorkoutQueryKey } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { formatKg, formatNumber, formatDate } from "@/lib/format";
import { Dumbbell, Activity, Flame, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: activeWorkoutResponse, isLoading: isLoadingActive } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const { data: stats, isLoading: isLoadingStats } = useGetStatsOverview();
  const { data: recentWorkouts, isLoading: isLoadingWorkouts } = useListWorkouts({ limit: 3 });

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
      <div className="p-4 space-y-8 pb-24">
        {/* Hero */}
        <section className="mt-8">
          <h1 className="text-3xl font-black mb-6 tracking-tight">Готов к работе?</h1>
          <Button 
            className="w-full h-20 text-xl font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
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

        {/* Quick Stats */}
        {stats && (
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold uppercase tracking-wider">Серия</span>
              </div>
              <div className="text-2xl font-black">{stats.currentStreakDays} <span className="text-sm font-medium text-muted-foreground">дней</span></div>
            </div>
            <div className="bg-card p-4 rounded-2xl border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider">Тоннаж</span>
              </div>
              <div className="text-2xl font-black">{formatKg(stats.totalVolume)}</div>
            </div>
          </section>
        )}

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
