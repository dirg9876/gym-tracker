import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetActiveWorkoutQueryKey,
  getGetProgressQueryKey,
  getGetStatsOverviewQueryKey,
  getGetWorkoutQueryKey,
  getListExercisesQueryKey,
  getListWorkoutsQueryKey,
  type PlannedExercise,
  type WorkoutSet,
  useAddSet,
  useCreateExercise,
  useDeleteSet,
  useFinishWorkout,
  useGetLevels,
  useGetWorkout,
  useListExercises,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ExercisePicker } from "@/components/ExercisePicker";
import { PreviousSets } from "@/components/PreviousSets";
import { RestTimer } from "@/components/RestTimer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SetCard } from "@/components/SetCard";
import { Stepper } from "@/components/Stepper";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { isBodyweight } from "@/lib/equipment";
import { formatKg, formatNumber } from "@/lib/format";
import { clearPlan, loadPlan } from "@/lib/programPlanStash";

export default function ActiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = parseInt(params.id || "0", 10);

  const { data: workout, isLoading } = useGetWorkout(workoutId, {
    query: { enabled: !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) },
  });
  const { data: exercises, isLoading: isExercisesLoading } = useListExercises();
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

  // Load plan from storage
  useEffect(() => {
    if (!workoutId) return;
    let mounted = true;
    loadPlan(workoutId).then((plan) => {
      if (mounted && plan) setPlanExercises(plan.exercises);
    });
    return () => {
      mounted = false;
    };
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

  // First-time auto-fill: when plan loads and nothing is selected.
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
        toast.show("success", "Подход добавлен");
        setRestTimerKey((key) => key + 1);
        // Auto-advance: if the just-added exercise has met its planned sets,
        // move on to the next planned exercise.
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
      onError: () => toast.show("error", "Ошибка"),
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
      onSuccess: async (report) => {
        queryClient.setQueryData(["finish-report", workoutId], report);
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        await clearPlan(workoutId);
        router.replace(`/workout/${workoutId}/report`);
      },
      onError: () => toast.show("error", "Не удалось завершить"),
    },
  });

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: (newExercise) => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        setSelectedExerciseId(newExercise.id);
        toast.show("success", "Упражнение создано");
      },
    },
  });

  const handleAddSet = () => {
    if (!selectedExerciseId) {
      toast.show("error", "Выберите упражнение");
      return;
    }
    if (isBwSelected && bodyWeightKg <= 0) {
      toast.show("error", "Подожди: загружаем вес тела. Если он не появится, укажи его в профиле.");
      return;
    }
    const submittedWeight = isBwSelected ? Math.max(0, bodyWeightKg + weight) : weight;
    addSet.mutate({
      workoutId,
      data: { exerciseId: selectedExerciseId, weightKg: submittedWeight, reps },
    });
  };

  const handleFinish = () => {
    if (!workout || workout.sets.length === 0) {
      toast.show("error", "Добавьте хотя бы один подход");
      return;
    }
    finishWorkout.mutate({ workoutId });
  };

  const handleRepeatLast = (lastWeight: number, lastReps: number) => {
    const extraWeight = isBwSelected ? Math.max(0, lastWeight - bodyWeightKg) : lastWeight;
    setWeight(extraWeight);
    setReps(lastReps);
    toast.show("success", "Загружены значения прошлого подхода");
  };

  const setsByExercise = useMemo<
    { exerciseId: number; name: string; sets: WorkoutSet[] }[]
  >(() => {
    if (!workout) return [];
    const map = new Map<number, { name: string; sets: WorkoutSet[] }>();
    for (const s of workout.sets) {
      const cur = map.get(s.exerciseId);
      if (cur) cur.sets.push(s);
      else map.set(s.exerciseId, { name: s.exerciseName, sets: [s] });
    }
    return Array.from(map.entries()).map(([exerciseId, v]) => ({
      exerciseId,
      name: v.name,
      sets: v.sets,
    }));
  }, [workout]);

  const uniqueExercises = setsByExercise.length;

  if (isLoading || isExercisesLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Тренировка не найдена" onBack={() => router.replace("/")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={workout.name || "Тренировка"} onBack={() => router.replace("/")} />

      {/* Running totals */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
        }}
      >
        {[
          { l: "Тоннаж", v: formatKg(workout.totalVolume) },
          { l: "Повторы", v: formatNumber(workout.totalReps) },
          { l: "Подходы", v: String(workout.totalSets) },
          { l: "Упр.", v: String(uniqueExercises) },
        ].map((s) => (
          <View key={s.l} style={{ alignItems: "center", flex: 1 }}>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 9,
                fontFamily: "Inter_700Bold",
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              {s.l}
            </Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontFamily: "Inter_700Bold",
                marginTop: 2,
              }}
            >
              {s.v}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 110,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Card padding={16}>
          <View style={{ gap: 16 }}>
            <ExercisePicker
              exercises={exercises || []}
              selectedId={selectedExerciseId}
              onSelect={setSelectedExerciseId}
              onCreate={(name, muscleGroup) =>
                createExercise.mutate({ data: { name, muscleGroup } })
              }
            />
            <Stepper
              label="Вес (кг)"
              value={weight}
              onChange={setWeight}
              step={2.5}
              min={0}
              chips={isBwSelected ? [0, 5, 10, 15, 20] : [20, 40, 60, 80, 100]}
            />
            {isBwSelected && bodyWeightKg > 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: -10 }}>
                = {formatNumber(weight)} + {formatNumber(bodyWeightKg)} кг с собственным весом
              </Text>
            ) : null}
            {isBwSelected && bodyWeightIsFallback ? (
              <Pressable
                onPress={() => router.push("/profile")}
                style={({ pressed }) => [
                  styles.warning,
                  {
                    backgroundColor: colors.amberSoft,
                    borderColor: colors.amber,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather name="alert-triangle" size={15} color={colors.amber} />
                <Text style={[styles.warningText, { color: colors.amber }]}>
                  Укажи свой вес в профиле, чтобы тоннаж упражнений со своим весом считался верно.
                  Сейчас используем {formatNumber(bodyWeightKg)} кг по умолчанию.
                </Text>
              </Pressable>
            ) : null}
            <Stepper
              label="Повторения"
              value={reps}
              onChange={setReps}
              step={1}
              min={1}
              chips={[1, 5, 8, 10, 12]}
            />
            <Button
              size="lg"
              fullWidth
              title={addSet.isPending ? "Добавление..." : "Добавить подход"}
              onPress={handleAddSet}
              disabled={!selectedExerciseId || addSet.isPending}
            />
          </View>
        </Card>

        {selectedExerciseId !== undefined ? (
          <PreviousSets exerciseId={selectedExerciseId} onRepeatLast={handleRepeatLast} />
        ) : null}

        <RestTimer key={restTimerKey} />

        {setsByExercise.map((group) => (
          <View key={group.exerciseId} style={{ gap: 8 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 16,
                fontFamily: "Inter_700Bold",
                paddingHorizontal: 4,
              }}
            >
              {group.name}
            </Text>
            <View style={{ gap: 6 }}>
              {group.sets.map((set, idx) => (
                <SetCard
                  key={set.id}
                  set={set}
                  index={idx + 1}
                  onDelete={() => deleteSet.mutate({ setId: set.id })}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.cardBorder,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Button
          size="lg"
          fullWidth
          variant="primary"
          title={finishWorkout.isPending ? "Завершение..." : "Завершить тренировку"}
          onPress={handleFinish}
          disabled={finishWorkout.isPending || workout.sets.length === 0}
          icon={<Feather name="check" size={18} color={colors.primaryForeground} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
