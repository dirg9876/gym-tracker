import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetWorkout, 
  useListExercises, 
  useAddSet, 
  useDeleteSet, 
  useFinishWorkout, 
  useCreateExercise,
  getGetWorkoutQueryKey,
  getGetActiveWorkoutQueryKey,
  getListWorkoutsQueryKey,
  getGetStatsOverviewQueryKey,
  getGetProgressQueryKey
} from "@workspace/api-client-react";
import { Stepper } from "@/components/Stepper";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SetCard } from "@/components/SetCard";
import { Button } from "@/components/ui/button";
import { formatKg, formatNumber } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function ActiveWorkout() {
  const params = useParams();
  const workoutId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: workout, isLoading: isWorkoutLoading } = useGetWorkout(workoutId, {
    query: { enabled: !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) }
  });
  
  const { data: exercises, isLoading: isExercisesLoading } = useListExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<number | undefined>();
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  
  const addSet = useAddSet({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        toast.success("Подход добавлен", { icon: <Check className="h-4 w-4" /> });
      }
    }
  });

  const deleteSet = useDeleteSet({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(workoutId) });
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
      }
    }
  });

  const finishWorkout = useFinishWorkout({
    mutation: {
      onSuccess: (report) => {
        queryClient.setQueryData(["finish-report", workoutId], report);
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        setLocation(`/workout/${workoutId}/report`);
      }
    }
  });

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: (newExercise) => {
        queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
        setSelectedExerciseId(newExercise.id);
        toast.success("Упражнение создано");
      }
    }
  });

  const handleAddSet = () => {
    if (!selectedExerciseId) {
      toast.error("Выберите упражнение");
      return;
    }
    addSet.mutate({
      workoutId,
      data: {
        exerciseId: selectedExerciseId,
        weightKg: weight,
        reps
      }
    });
  };

  const handleFinish = () => {
    if (workout?.sets.length === 0) {
      toast.error("Добавьте хотя бы один подход");
      return;
    }
    finishWorkout.mutate({ workoutId });
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
          <motion.div key={workout.totalVolume} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Тоннаж</span>
            <span className="font-mono font-bold">{formatKg(workout.totalVolume)}</span>
          </motion.div>
          <motion.div key={workout.totalReps} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Повторы</span>
            <span className="font-mono font-bold">{formatNumber(workout.totalReps)}</span>
          </motion.div>
          <motion.div key={workout.totalSets} initial={{ scale: 1.1, color: "hsl(var(--primary))" }} animate={{ scale: 1, color: "inherit" }} className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Подходы</span>
            <span className="font-mono font-bold">{workout.totalSets}</span>
          </motion.div>
          <div className="flex flex-col items-center">
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Упражнения</span>
            <span className="font-mono font-bold">{uniqueExercises}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto p-4 space-y-6">
        
        {/* Logger Form */}
        <div className="bg-card p-4 rounded-3xl border border-border shadow-sm space-y-6">
          <ExercisePicker 
            exercises={exercises || []} 
            selectedId={selectedExerciseId}
            onSelect={setSelectedExerciseId}
            onCreate={(name, muscleGroup) => createExercise.mutate({ data: { name, muscleGroup } })}
          />

          <Stepper 
            label="Вес (кг)" 
            value={weight} 
            onChange={setWeight} 
            step={2.5}
            min={0}
            chips={[20, 40, 60, 80, 100]}
          />

          <Stepper 
            label="Повторения" 
            value={reps} 
            onChange={setReps} 
            step={1}
            min={1}
            chips={[1, 5, 8, 10, 12]}
          />

          <Button 
            className="w-full h-16 text-lg font-bold rounded-2xl" 
            onClick={handleAddSet}
            disabled={!selectedExerciseId || addSet.isPending}
          >
            {addSet.isPending ? "Добавление..." : "Добавить подход"}
          </Button>
        </div>

        {/* Logged Sets */}
        <div className="space-y-6">
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
            className="w-full h-16 text-xl font-black rounded-2xl shadow-xl shadow-primary/20"
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
