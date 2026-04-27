import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetWorkout,
  useListExercises,
  useGetLevels,
  useGetExerciseNorms,
  useAddSet,
  useDeleteSet,
  useFinishWorkout,
  useCreateExercise,
  getGetWorkoutQueryKey,
  getGetActiveWorkoutQueryKey,
  getListWorkoutsQueryKey,
  getGetStatsOverviewQueryKey,
  getGetProgressQueryKey,
  type PlannedExercise,
  type WorkoutSet,
} from "@workspace/api-client-react";
import { RankBadge } from "@/components/RankBadge";
import { isBodyweight } from "@/lib/equipment";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Stepper } from "@/components/Stepper";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SetCard } from "@/components/SetCard";
import { RestTimer } from "@/components/RestTimer";
import { PreviousSets } from "@/components/PreviousSets";
import { Button } from "@/components/ui/button";
import { formatKg, formatNumber } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { clearPlan, loadPlan } from "@/lib/programPlanStash";

export function ActiveWorkout() {
  const params = useParams();
  const workoutId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: workout, isLoading: isWorkoutLoading } = useGetWorkout(workoutId, {
    query: { enabled: !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) },
  });

  const { data: exercises, isLoading: isExercisesLoading } = useListExercises();
  // Bodyweight (and the fallback flag) lives on the levels endpoint — it's
  // already cached for /levels and avoids an extra dedicated profile fetch.
  const { data: levelsData } = useGetLevels();
  const bodyWeightKg = levelsData?.bodyWeightKg ?? 0;
  const bodyWeightIsFallback = levelsData?.bodyWeightIsFallback ?? false;

  const [selectedExerciseId, setSelectedExerciseId] = useState<number | undefined>();
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [planExercises, setPlanExercises] = useState<PlannedExercise[]>([]);
  const [restTimerKey, setRestTimerKey] = useState(0);

  const selectedExercise = exercises?.find((e) => e.id === selectedExerciseId);
  const isBwSelected = isBodyweight(selectedExercise?.equipment);

  // Fetch rank norms for selected exercise (skip for bodyweight exercises — no rank norms apply).
  const { data: exerciseNorms } = useGetExerciseNorms(selectedExerciseId ?? 0, {
    query: { enabled: !!selectedExerciseId && !isBwSelected, staleTime: 5 * 60 * 1000 },
  });

  // Derive the rank achieved by the current weight and the next-rank hint (if ≤ 15 kg away).
  const rankHint = useMemo(() => {
    const norms = exerciseNorms?.rankNorms;
    if (!norms?.length || isBwSelected) return null;
    // rankNorms is ascending: Б/Р (kgTarget≈0) → МСМК (highest kgTarget).
    let achievedIdx = -1;
    for (let i = 0; i < norms.length; i++) {
      if (weight >= norms[i]!.kgTarget) achievedIdx = i;
    }
    const achieved = achievedIdx >= 0 ? norms[achievedIdx]! : null;
    const nextEntry = achievedIdx < norms.length - 1 ? norms[achievedIdx + 1]! : null;
    const delta = nextEntry ? Math.ceil(nextEntry.kgTarget - weight) : null;
    const showNext = delta !== null && delta > 0 && delta <= 15;
    return { achieved, next: showNext ? nextEntry : null, delta: showNext ? delta : null };
  }, [exerciseNorms, weight, isBwSelected]);

  // When the user switches the picker to a bodyweight exercise, reset the
  // weight stepper to 0 — for bodyweight exercises the field means "extra
  // weight added on top of bodyweight", and the default must be 0 (no
  // plate / weight belt) per the product requirement. We only fire this on
  // an actual transition into a bodyweight exercise so we don't clobber a
  // value the user is currently editing for a non-bodyweight exercise.
  const prevBwRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (selectedExerciseId === undefined) {
      prevBwRef.current = null;
      return;
    }
    if (isBwSelected && prevBwRef.current !== true) {
      setWeight(0);
    }
    prevBwRef.current = isBwSelected;
  }, [selectedExerciseId, isBwSelected]);

  // Load plan from localStorage
  useEffect(() => {
    if (!workoutId) return;
    const plan = loadPlan(workoutId);
    if (plan) setPlanExercises(plan.exercises);
  }, [workoutId]);

  // Pick the next planned exercise that hasn't met its planned set count yet.
  const pickNextPlanned = useCallback(
    (sets: WorkoutSet[]) => {
      if (planExercises.length === 0) return undefined;
      const counts = new Map<number, number>();
      for (const s of sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
      return planExercises.find((p) => (counts.get(p.exerciseId) ?? 0) < p.sets);
    },
    [planExercises],
  );

  const fillFromPlan = useCallback((p: PlannedExercise) => {
    setSelectedExerciseId(p.exerciseId);
    if (!p.isBodyweight && p.suggestedWeightKg > 0) setWeight(p.suggestedWeightKg);
    else if (p.isBodyweight) setWeight(0);
    const targetReps = Math.round((p.repsMin + p.repsMax) / 2);
    if (targetReps > 0) setReps(targetReps);
  }, []);

  // First-time auto-fill when plan loads and nothing is selected.
  useEffect(() => {
    if (!workout || selectedExerciseId !== undefined) return;
    const next = pickNextPlanned(workout.sets);
    if (next) fillFromPlan(next);
  }, [workout, selectedExerciseId, pickNextPlanned, fillFromPlan]);

  const addSet = useAddSet({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        toast.success("Подход добавлен", { icon: <Check className="h-4 w-4" /> });
        // Bump rest timer key — start a fresh timer ready for the user.
        setRestTimerKey((k) => k + 1);
        // Auto-advance: if just-added exercise has met its planned sets, move on.
        if (planExercises.length > 0 && workout) {
          const projectedSets: WorkoutSet[] = [
            ...workout.sets,
            {
              id: -1,
              exerciseId: variables.data.exerciseId,
              exerciseName: "",
              muscleGroup: "",
              weightKg: variables.data.weightKg,
              reps: variables.data.reps,
              volume: variables.data.weightKg * variables.data.reps,
              createdAt: new Date().toISOString(),
            } as WorkoutSet,
          ];
          const next = pickNextPlanned(projectedSets);
          if (next && next.exerciseId !== variables.data.exerciseId) {
            fillFromPlan(next);
          }
        }
      },
    },
  });

  const deleteSet = useDeleteSet({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
      },
    },
  });

  const finishWorkout = useFinishWorkout({
    mutation: {
      onSuccess: (report) => {
        queryClient.setQueryData(["finish-report", workoutId], report);
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        clearPlan(workoutId);
        setLocation(`/workout/${workoutId}/report`);
      },
    },
  });

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: (newExercise) => {
        queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
        setSelectedExerciseId(newExercise.id);
        toast.success("Упражнение создано");
      },
    },
  });

  const handleAddSet = () => {
    if (!selectedExerciseId) {
      toast.error("Выберите упражнение");
      return;
    }
    // For bodyweight exercises the user enters extra weight (e.g. plate on
    // a belt for pull-ups); the actual top-set weight stored in the DB is
    // bodyweight + extra so tonnage and PRs reflect the real load. Guard
    // against logging while /levels is still in flight — bodyWeightKg
    // would be 0 in that window and we'd write only the extra weight,
    // silently corrupting tonnage/PRs for the user.
    if (isBwSelected && bodyWeightKg <= 0) {
      toast.error(
        "Подожди секунду — загружаем твой вес. Если он не подгрузится, укажи его в профиле.",
      );
      return;
    }
    const submittedWeight = isBwSelected
      ? Math.max(0, bodyWeightKg + weight)
      : weight;
    addSet.mutate({
      workoutId,
      data: {
        exerciseId: selectedExerciseId,
        weightKg: submittedWeight,
        reps,
      },
    });
  };

  const handleFinish = () => {
    if (workout?.sets.length === 0) {
      toast.error("Добавьте хотя бы один подход");
      return;
    }
    finishWorkout.mutate({ workoutId });
  };

  const handleRepeatLast = (w: number, r: number) => {
    setWeight(w);
    setReps(r);
    toast.success("Загружены значения предыдущего подхода");
  };

  if (isWorkoutLoading || isExercisesLoading) {
    return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  }

  if (!workout) return <div className="p-4">Тренировка не найдена</div>;

  // Group sets by exercise for display
  const setsByExercise = workout.sets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) acc[set.exerciseId] = [];
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<number, typeof workout.sets>);

  const uniqueExercises = Object.keys(setsByExercise).length;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground pb-24">
      {/* Top Running Totals */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-center text-sm">
          <motion.div key={`vol-${workout.totalVolume}`} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-normal">Тоннаж</span>
            <span className="font-mono font-bold">{formatKg(workout.totalVolume)}</span>
          </motion.div>
          <motion.div key={`reps-${workout.totalReps}`} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-normal">Повторы</span>
            <span className="font-mono font-bold">{formatNumber(workout.totalReps)}</span>
          </motion.div>
          <motion.div key={`sets-${workout.totalSets}`} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-normal">Подходы</span>
            <span className="font-mono font-bold">{workout.totalSets}</span>
          </motion.div>
          <div className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-normal">Упражнения</span>
            <span className="font-mono font-bold">{uniqueExercises}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto p-4 space-y-4">

        {/* Logger Form */}
        <div className="bg-card p-4 rounded-3xl border border-border shadow-sm space-y-6">
          <ExercisePicker
            exercises={exercises || []}
            selectedId={selectedExerciseId}
            onSelect={setSelectedExerciseId}
            onCreate={(name, muscleGroup) => createExercise.mutate({ data: { name, muscleGroup } })}
          />

          <Stepper
            label={isBwSelected ? "Доп. вес (кг)" : "Вес (кг)"}
            value={weight}
            onChange={setWeight}
            step={2.5}
            min={0}
            chips={isBwSelected ? [0, 5, 10, 15, 20] : [20, 40, 60, 80, 100]}
          />

          {/* Rank hint: shown only for non-bodyweight exercises with norms */}
          <AnimatePresence mode="wait">
            {rankHint?.achieved && (
              <motion.div
                key={rankHint.achieved.rank.code}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="-mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <RankBadge rank={rankHint.achieved.rank} variant="compact" />
                {rankHint.next && rankHint.delta !== null && (
                  <span className="text-muted-foreground/60">
                    · до {rankHint.next.rank.shortLabel}: +{rankHint.delta} кг
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isBwSelected && bodyWeightKg > 0 && (
            <div className="-mt-3 text-xs text-muted-foreground">
              = {formatNumber(weight)} + {formatNumber(bodyWeightKg)} кг с собственным весом
            </div>
          )}
          {isBwSelected && bodyWeightIsFallback && (
            <Link
              href="/profile"
              className="-mt-2 flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-2.5 py-2 hover:bg-amber-500/15"
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Укажи свой вес в профиле, чтобы тоннаж по упражнениям с
                собственным весом считался верно. Сейчас используем {formatNumber(bodyWeightKg)} кг
                по умолчанию.
              </span>
            </Link>
          )}

          <Stepper
            label="Повторения"
            value={reps}
            onChange={setReps}
            step={1}
            min={1}
            chips={[1, 5, 8, 10, 12]}
          />

          <Button
            className="w-full min-h-16 h-auto py-3 text-lg font-bold rounded-2xl"
            onClick={handleAddSet}
            disabled={!selectedExerciseId || addSet.isPending}
          >
            {addSet.isPending ? "Добавление..." : "Добавить подход"}
          </Button>
        </div>

        {selectedExerciseId !== undefined && (
          <PreviousSets
            exerciseId={selectedExerciseId}
            onRepeatLast={handleRepeatLast}
          />
        )}

        <RestTimer key={restTimerKey} />

        {/* Logged Sets */}
        <div className="space-y-6 pt-2">
          <AnimatePresence>
            {Object.entries(setsByExercise).map(([exerciseIdStr, sets]) => {
              const exId = parseInt(exerciseIdStr, 10);
              const exName = sets[0].exerciseName;
              return (
                <motion.div
                  key={exId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <h3 className="font-bold text-lg sticky top-16 bg-background/80 backdrop-blur py-2 z-0">{exName}</h3>
                  <div className="space-y-2">
                    {sets.map((set, idx) => (
                      <SetCard
                        key={set.id}
                        set={set}
                        index={idx + 1}
                        onDelete={() => deleteSet.mutate({ setId: set.id })}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Finish Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pb-8">
        <div className="max-w-md mx-auto">
          <Button
            variant="default"
            className="w-full min-h-16 h-auto py-3 text-lg font-black rounded-2xl shadow-xl shadow-primary/20"
            onClick={handleFinish}
            disabled={finishWorkout.isPending || workout.sets.length === 0}
          >
            {finishWorkout.isPending ? "Завершение..." : "Завершить тренировку"}
          </Button>
        </div>
      </div>
    </div>
  );
}
