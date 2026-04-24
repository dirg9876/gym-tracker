import { useParams, useLocation } from "wouter";
import { useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { formatKg, formatNumber, formatDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HistoryDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();

  const { data: workout, isLoading } = useGetWorkout(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutQueryKey(id) }
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!workout) return <div className="p-8 text-center">Тренировка не найдена</div>;

  const setsByExercise = workout.sets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) acc[set.exerciseId] = [];
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<number, typeof workout.sets>);

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/history')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">{workout.name || "Тренировка"}</h1>
            <div className="text-xs text-muted-foreground">{formatDate(workout.startedAt)}</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Тоннаж</div>
            <div className="font-mono text-2xl font-black">{formatKg(workout.totalVolume)}</div>
          </div>
          <div className="bg-card p-4 rounded-2xl border border-border">
            <div className="text-xs font-bold uppercase text-muted-foreground mb-1">Повторы</div>
            <div className="font-mono text-2xl font-black">{formatNumber(workout.totalReps)}</div>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(setsByExercise).map(([exerciseIdStr, sets]) => {
            const exName = sets[0].exerciseName;
            const exVolume = sets.reduce((sum, s) => sum + s.volume, 0);
            
            return (
              <div key={exerciseIdStr} className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                  <h3 className="font-bold">{exName}</h3>
                  <span className="text-sm font-mono text-muted-foreground">{formatKg(exVolume)}</span>
                </div>
                <div className="p-2 space-y-1">
                  {sets.map((set, idx) => (
                    <div key={set.id} className="flex justify-between items-center px-4 py-2 hover:bg-muted/50 rounded-lg">
                      <div className="text-muted-foreground text-sm w-8">{idx + 1}</div>
                      <div className="font-mono font-medium">
                        {formatKg(set.weightKg)} <span className="text-muted-foreground mx-1">×</span> {set.reps}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
