import { useListWorkouts } from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { useLocation } from "wouter";
import { formatKg, formatNumber, formatDate } from "@/lib/format";

export function History() {
  const [, setLocation] = useLocation();
  const { data: workouts, isLoading } = useListWorkouts({ limit: 50 });

  if (isLoading) return <AppShell><div className="p-8 text-center">Загрузка...</div></AppShell>;

  return (
    <AppShell>
      <div className="p-4 space-y-6">
        <h1 className="text-3xl font-black mt-4 mb-6">История</h1>

        {!workouts || workouts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>Нет тренировок</p>
            <p className="text-sm mt-2">Начните свою первую тренировку на главной!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workouts.map((workout) => (
              <div 
                key={workout.id} 
                className="bg-card p-5 rounded-2xl border border-border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setLocation(`/history/${workout.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{workout.name || "Тренировка"}</h3>
                  <span className="text-sm font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    {formatDate(workout.startedAt)}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-background rounded-lg p-2 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Тоннаж</div>
                    <div className="font-mono font-bold text-sm">{formatKg(workout.totalVolume)}</div>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Повторы</div>
                    <div className="font-mono font-bold text-sm">{formatNumber(workout.totalReps)}</div>
                  </div>
                  <div className="bg-background rounded-lg p-2 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Подходы</div>
                    <div className="font-mono font-bold text-sm">{workout.totalSets}</div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground line-clamp-1">
                  {workout.topExercises.join(" • ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
