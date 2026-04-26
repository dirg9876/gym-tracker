import { useLocation, useParams } from "wouter";
import {
  useGetWorkout,
  useGetWorkoutExerciseBreakdown,
  getGetWorkoutQueryKey,
  getGetWorkoutExerciseBreakdownQueryKey,
  WorkoutReport as WorkoutReportType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PRBadge } from "@/components/PRBadge";
import { ExerciseProgressCard } from "@/components/ExerciseProgressCard";
import { Button } from "@/components/ui/button";
import { WorkoutComparisonPanel } from "@/components/WorkoutComparisonPanel";
import { formatKg, formatNumber, formatDuration } from "@/lib/format";
import { CheckCircle2, Trophy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function WorkoutReport() {
  const params = useParams();
  const workoutId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const report = queryClient.getQueryData(["finish-report", workoutId]) as WorkoutReportType | undefined;
  
  // Fallback if accessed directly
  const { data: workout, isLoading } = useGetWorkout(workoutId, {
    query: { enabled: !report && !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) }
  });

  // If we don't have the in-memory report (e.g. user navigated here directly),
  // fetch the per-exercise breakdown from the dedicated endpoint.
  const { data: standaloneBreakdown } = useGetWorkoutExerciseBreakdown(workoutId, {
    query: {
      enabled: !report && !!workoutId,
      queryKey: getGetWorkoutExerciseBreakdownQueryKey(workoutId),
    },
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;
  if (!report && !workout) return <div className="p-8 text-center">Отчет не найден</div>;

  const w = report?.workout || workout!;
  const hasPRs = report && (report.newPersonalRecords.length > 0 || report.newExerciseRecords.length > 0);
  const breakdown = report?.exerciseBreakdown ?? standaloneBreakdown?.items ?? [];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Celebration */}
      <div className="bg-card border-b border-border pt-16 pb-10 px-4 rounded-b-[3rem] shadow-sm">
        <div className="max-w-md mx-auto text-center space-y-4">
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 15 }}
            className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary"
          >
            {hasPRs ? <Trophy className="w-12 h-12" /> : <CheckCircle2 className="w-12 h-12" />}
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black tracking-tight"
          >
            Тренировка завершена!
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4 mt-8"
          >
            <div className="bg-background/50 rounded-2xl p-4 border border-border">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-normal mb-1">Тоннаж</div>
              <div className="break-words text-2xl font-black leading-tight">{formatKg(w.totalVolume)}</div>
            </div>
            <div className="bg-background/50 rounded-2xl p-4 border border-border">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-normal mb-1">Время</div>
              <div className="break-words text-2xl font-black leading-tight">{report ? formatDuration(report.durationMinutes) : "-"}</div>
            </div>
            <div className="bg-background/50 rounded-2xl p-4 border border-border">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-normal mb-1">Повторы</div>
              <div className="break-words text-2xl font-black leading-tight">{formatNumber(w.totalReps)}</div>
            </div>
            <div className="bg-background/50 rounded-2xl p-4 border border-border">
              <div className="text-muted-foreground text-xs font-bold uppercase tracking-normal mb-1">Подходы</div>
              <div className="break-words text-2xl font-black leading-tight">{w.totalSets}</div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-8 mt-6">
        {/* Comparison vs previous workout */}
        <WorkoutComparisonPanel workoutId={workoutId} />

        {/* Personal Records */}
        {report && report.newPersonalRecords.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold px-2">Новые рекорды</h2>
            <div className="space-y-3">
              {report.newPersonalRecords.map((pr, i) => (
                <PRBadge 
                  key={`${pr.kind}-${i}`}
                  kind={pr.kind}
                  value={pr.value}
                  delta={pr.delta}
                  formatFn={pr.kind === 'reps' ? formatNumber : formatKg}
                  delay={0.1 + i * 0.1}
                />
              ))}
            </div>
          </section>
        )}

        {/* Exercise Records */}
        {report && report.newExerciseRecords.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold px-2">Рекорды в упражнениях</h2>
            <div className="space-y-3">
              {report.newExerciseRecords.map((er, i) => (
                <PRBadge 
                  key={`${er.exerciseId}-${er.kind}-${i}`}
                  kind={er.kind}
                  value={er.value}
                  delta={er.value - er.previous}
                  formatFn={er.kind === 'max_reps' ? formatNumber : formatKg}
                  delay={0.3 + i * 0.1}
                />
              ))}
            </div>
          </section>
        )}

        {/* Per-exercise progress */}
        {breakdown.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold px-2">Сводка по упражнениям</h2>
            <div className="space-y-3">
              {breakdown.map((item) => (
                <ExerciseProgressCard key={item.exerciseId} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pb-8">
        <div className="max-w-md mx-auto">
          <Button 
            className="w-full min-h-16 h-auto py-3 text-lg font-bold rounded-2xl"
            onClick={() => setLocation('/')}
          >
            На главную <ArrowRight className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
