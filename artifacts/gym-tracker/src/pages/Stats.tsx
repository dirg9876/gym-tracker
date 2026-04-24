import { useGetStatsOverview, useGetProgress } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressLineChart } from "@/components/charts/ProgressLineChart";
import { MuscleGroupBarChart } from "@/components/charts/MuscleGroupBarChart";
import { formatKg, formatNumber } from "@/lib/format";
import { Dumbbell, Activity, CalendarDays, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

export function Stats() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsOverview();
  const { data: progress, isLoading: isProgressLoading } = useGetProgress();

  if (isStatsLoading || isProgressLoading) {
    return <AppShell><div className="p-8 text-center">Загрузка...</div></AppShell>;
  }

  if (!stats || !progress) return <AppShell><div className="p-8">Нет данных</div></AppShell>;

  return (
    <AppShell>
      <div className="p-4 space-y-8">
        <h1 className="text-3xl font-black mt-4">Статистика</h1>

        {/* Highlights */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card p-4 rounded-2xl border border-border col-span-2">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Максимальный тоннаж</span>
            </div>
            <div className="text-3xl font-black text-primary">{formatKg(stats.bestTonnage)}</div>
          </div>
          
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Рекорд повторов</div>
            <div className="text-xl font-black">{formatNumber(stats.bestReps)}</div>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Макс. вес</div>
            <div className="text-xl font-black">{formatKg(stats.bestMaxWeight)}</div>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Всего трен.</div>
            <div className="text-xl font-black">{stats.totalWorkouts}</div>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Серия (дней)</div>
            <div className="text-xl font-black">{stats.currentStreakDays}</div>
          </div>
        </div>

        {/* Charts */}
        {progress.points.length > 0 && (
          <div className="space-y-8">
            <section className="bg-card p-4 rounded-3xl border border-border">
              <h2 className="font-bold text-lg mb-6 ml-2">Тоннаж</h2>
              <ProgressLineChart 
                data={progress.points} 
                dataKey="volume" 
                color="hsl(var(--chart-1))"
                formatValue={formatKg}
              />
            </section>
            
            <section className="bg-card p-4 rounded-3xl border border-border">
              <h2 className="font-bold text-lg mb-6 ml-2">Повторения</h2>
              <ProgressLineChart 
                data={progress.points} 
                dataKey="reps" 
                color="hsl(var(--chart-2))"
                formatValue={formatNumber}
              />
            </section>
          </div>
        )}

        {/* Muscle Groups */}
        {stats.muscleGroupVolume.length > 0 && (
          <section className="bg-card p-4 rounded-3xl border border-border">
            <h2 className="font-bold text-lg mb-6 ml-2">Объем по мышцам</h2>
            <MuscleGroupBarChart data={stats.muscleGroupVolume} />
          </section>
        )}

        {/* Top Exercises */}
        {stats.topExercises.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 ml-2">Топ упражнений</h2>
            <div className="bg-card rounded-3xl border border-border overflow-hidden divide-y divide-border">
              {stats.topExercises.map((ex, i) => (
                <div 
                  key={ex.exerciseId}
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setLocation(`/exercises/${ex.exerciseId}`)}
                >
                  <div className="w-8 font-black text-muted-foreground text-xl">{i+1}</div>
                  <div className="flex-1">
                    <div className="font-bold">{ex.name}</div>
                    <div className="text-sm text-muted-foreground">{ex.muscleGroup}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-primary">{formatKg(ex.volume)}</div>
                    <div className="text-xs text-muted-foreground uppercase">{ex.sets} подх.</div>
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
