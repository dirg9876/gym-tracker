import { useParams, useLocation } from "wouter";
import { useGetExerciseProgress, getGetExerciseProgressQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLineChart } from "@/components/charts/ProgressLineChart";
import { formatKg, formatNumber } from "@/lib/format";

export function ExerciseProgress() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: progress, isLoading } = useGetExerciseProgress(id, {
    query: { enabled: !!id, queryKey: getGetExerciseProgressQueryKey(id) }
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!progress) return <div className="p-8 text-center">Упражнение не найдено</div>;

  const { exercise, points } = progress;
  
  // Calculate records from points
  const maxWeight = Math.max(...points.map(p => p.maxWeight), 0);
  const maxVolume = Math.max(...points.map(p => p.volume), 0);
  const maxReps = Math.max(...points.map(p => p.reps), 0);

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">{exercise.name}</h1>
            <div className="text-xs text-primary font-bold uppercase tracking-wider">{exercise.muscleGroup}</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-8 mt-4">
        {/* Records */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Макс. Вес</div>
            <div className="font-mono text-xl font-black text-primary">{formatKg(maxWeight)}</div>
          </div>
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Рекорд Объема</div>
            <div className="font-mono text-xl font-black">{formatKg(maxVolume)}</div>
          </div>
          <div className="bg-card p-3 rounded-2xl border border-border text-center">
            <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Макс. Повторов</div>
            <div className="font-mono text-xl font-black">{formatNumber(maxReps)}</div>
          </div>
        </div>

        {points.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Нет данных о тренировках
          </div>
        ) : (
          <div className="space-y-8">
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
                  <div key={point.workoutId} className="p-4 flex justify-between items-center hover:bg-accent cursor-pointer" onClick={() => setLocation(`/history/${point.workoutId}`)}>
                    <div className="text-sm text-muted-foreground">
                      {new Date(point.date).toLocaleDateString('ru-RU')}
                    </div>
                    <div className="font-mono font-bold text-lg">
                      {formatKg(point.topSet.weightKg)} <span className="text-muted-foreground mx-1 font-sans text-sm">×</span> {point.topSet.reps}
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
