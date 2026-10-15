import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetActiveWorkoutQueryKey,
  getGetExerciseProgressQueryKey,
  getGetHeatmapQueryKey,
  getGetLevelsQueryKey,
  getGetProgressQueryKey,
  getGetStatsOverviewQueryKey,
  getGetWorkoutQueryKey,
  getListExercisesQueryKey,
  getListWorkoutsQueryKey,
  type WorkoutSet,
  useCreateExercise,
  useDeleteSet,
  useFinishWorkout,
  useGetWorkout,
  useGetProfile,
  useListExercises,
} from "@workspace/api-client-react";
import { weightClass } from "@workspace/level-data/strength";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { AiCoachPanel } from "@/components/AiCoachPanel";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { SetCard } from "@/components/SetCard";
import { Stepper } from "@/components/Stepper";
import { Segmented } from "@/components/Segmented";
import { TrainingTimer } from "@/components/TrainingTimer";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";
import { returnToBrand } from "@/lib/navigation";
import { loadPlan } from "@/lib/programPlanStash";
import { durationOf, formatSeconds, isTimedExercise, minimumWeight, weightLabel, type MeasuredSet } from "@/lib/workoutMeasurement";
import { exerciseRankHint } from "@/lib/rankHint";
import { formatStandard } from "@/lib/exerciseStandards";
import { completedTargets, plannedSet, type TemplateExercise } from "@/lib/workoutTemplates";
import { nextWorkingLoad, type CoachFields } from "@/lib/trainingCoach";
import { coachRequest } from "@/lib/coachApi";
import { makeWorkoutDraft, type WorkoutDraft } from "@/lib/workoutDraft";
import { useWorkoutDraft } from "@/hooks/useWorkoutDraft";
import { useAiConnection } from "@/hooks/useAiCoach";

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

  const draft = useWorkoutDraft(workoutId);
  const aiConnection = useAiConnection();
  const selectedExerciseId = draft.value?.exerciseId;
  const weight = draft.value?.weightKg ?? 20;
  const reps = draft.value?.reps ?? 10;
  const seconds = draft.value?.durationSeconds ?? 30;
  const rir = draft.value?.rir ?? null;
  const technique = draft.value?.technique ?? null;
  const [deleting, setDeleting] = useState(false);
  const [planExercises, setPlanExercises] = useState<TemplateExercise[]>([]);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const calibration = planExercises.find(ex => ex.exerciseId === selectedExerciseId)?.calibration && !workout?.sets.some(set => set.exerciseId === selectedExerciseId);
  const selectedExercise = exercises?.find(exercise => exercise.id === selectedExerciseId);
  const { data: recorded } = useQuery({ queryKey: ["working-load", selectedExerciseId], queryFn: () => coachRequest<{ sets: MeasuredSet[] }>(`/api/exercises/${selectedExerciseId}/working-load`), enabled: !!selectedExerciseId });
  const timed = isTimedExercise(selectedExercise?.name ?? "");
  const { data: profile } = useGetProfile();
  const rankHint = exerciseRankHint(selectedExercise, profile, timed ? seconds : selectedExercise?.equipment === "bodyweight" ? reps : weight);
  const selectExercise = (id: number) => {
    const exercise = exercises?.find(item => item.id === id);
    if (!exercise || !draft.ready || draft.saving) return;
    const planned = planExercises.find(item => item.exerciseId === id);
    void draft.save(makeWorkoutDraft(exercise, planned ? plannedSet(planned, completedTargets(planned, workout?.sets ?? [])) : undefined)).catch(() => {});
  };
  const changeDraft = (values: Partial<WorkoutDraft>) => {
    if (!draft.value || !draft.ready || draft.saving) return;
    const { sourceTimer: _sourceTimer, ...current } = draft.value;
    void draft.save({ ...current, ...values }).catch(() => {});
  };

  // Load plan from storage
  useFocusEffect(useCallback(() => {
    if (!workoutId || !exercises) return;
    let mounted = true;
    setPlanLoaded(false);
    loadPlan(workoutId).then((plan) => {
      if (mounted) { setPlanExercises((plan?.exercises ?? []).filter(ex => exercises.some(item => item.id === ex.exerciseId))); setPlanLoaded(true); }
    });
    return () => {
      mounted = false;
    };
  }, [workoutId, exercises, workout?.totalSets]));

  // Legacy active plans have no draft yet; never overwrite a restored draft.
  useEffect(() => {
    if (!workout || workout.finishedAt || !draft.ready || draft.saving || draft.error || !planLoaded || draft.value) return;
    const next = planExercises.find(ex => completedTargets(ex, workout.sets) < ex.sets);
    const exercise = exercises?.find(ex => ex.id === next?.exerciseId);
    if (next && exercise) void draft.save(makeWorkoutDraft(exercise, plannedSet(next, completedTargets(next, workout.sets)))).catch(() => {});
  }, [workout, draft, planLoaded, planExercises, exercises]);

  const addSet = useMutation({
      mutationFn: () => draft.commit(),
      onSuccess: () => {
        toast.show("success", "Подход добавлен");
      },
      onError: (error) => toast.show("error", error instanceof Error ? error.message : "Не удалось добавить подход"),
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
        queryClient.setQueryData(getGetWorkoutQueryKey(workoutId), report.workout);
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetHeatmapQueryKey() });
        for (const exerciseId of new Set(report.workout.sets.map(set => set.exerciseId))) {
          queryClient.invalidateQueries({ queryKey: getGetExerciseProgressQueryKey(exerciseId) });
        }
        queryClient.invalidateQueries({ queryKey: ["coach-weekly"] });
        queryClient.invalidateQueries({ queryKey: ["working-load"] });
        queryClient.removeQueries({ queryKey: ["coach-timer", workoutId] });
        queryClient.removeQueries({ queryKey: ["workout-draft", workoutId] });
        router.replace(`/workout/${workoutId}/report`);
      },
      onError: () => toast.show("error", "Не удалось завершить"),
    },
  });

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: async (newExercise) => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        await draft.save(makeWorkoutDraft(newExercise)).catch(() => {});
        toast.show("success", "Упражнение создано");
      },
    },
  });

  const handleAddSet = () => {
    if (!selectedExerciseId) {
      toast.show("error", "Выберите упражнение");
      return;
    }
    if (!draft.ready || draft.saving || draft.error) return;
    addSet.mutate();
  };

  const handleFinish = () => {
    if (!workout || workout.sets.length === 0) {
      toast.show("error", "Добавьте хотя бы один подход");
      return;
    }
    const incomplete = planExercises.filter(ex => completedTargets(ex, workout.sets) < ex.sets);
    if (incomplete.length) Alert.alert("План выполнен не полностью", `Остались упражнения: ${incomplete.map(ex => ex.name).join(", ")}. Завершить раньше?`, [{ text: "Продолжить", style: "cancel" }, { text: "Завершить", onPress: () => finishWorkout.mutate({ workoutId }) }]);
    else finishWorkout.mutate({ workoutId });
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
  const selectedPlan = planExercises.find(ex => ex.exerciseId === selectedExerciseId);
  const selectedSetCount = selectedPlan ? completedTargets(selectedPlan, workout?.sets ?? []) : 0;
  const lastWorking = recorded?.sets.at(-1);
  const advice = !timed ? selectedPlan ? nextWorkingLoad(recorded?.sets ?? [], selectedPlan) : lastWorking ? { weightKg: lastWorking.weightKg, increase: false, reason: "Последний рабочий вес; без повышения вне плана" } : null : null;
  const formBusy = !draft.ready || draft.saving || addSet.isPending || deleteSet.isPending || finishWorkout.isPending || deleting;

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
        <ScreenHeader title="Тренировка не найдена" onBack={returnToBrand} />
      </View>
    );
  }

  if (workout.finishedAt && !finishWorkout.isPending) {
    return <Redirect href={`/history/${workoutId}`} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={workout.name || "Тренировка"} onBack={returnToBrand} right={<DeleteWorkoutButton workoutId={workoutId} name={workout.name || "Тренировка"} disabled={formBusy || deleteSet.isPending} onPendingChange={setDeleting} onDeleted={returnToBrand} />} />

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
                letterSpacing: 0,
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

      {durationOf(workout) > 0 ? <Text style={{ color: colors.mutedForeground, paddingHorizontal: 16, paddingVertical: 6 }}>Удержания: {formatSeconds(durationOf(workout))}</Text> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
          <View style={{ gap: 12 }}>
            {aiConnection.data?.enabled ? <Button title="Написать тренеру" variant="secondary" disabled={formBusy || !!draft.error} icon={<Feather name="message-circle" size={18} color={colors.success} />} onPress={() => router.push(`/coach-session?workoutId=${workoutId}`)} /> : null}
            <ExercisePicker
              profile={profile}
              exercises={exercises || []}
              selectedId={selectedExerciseId}
              disabled={formBusy || !planLoaded}
              onSelect={selectExercise}
              onCreate={(name, muscleGroup) =>
                createExercise.mutateAsync({ data: { name, muscleGroup } })
              }
            />
            {selectedPlan ? <Text style={{ color: selectedSetCount >= selectedPlan.sets ? colors.success : colors.mutedForeground, fontSize: 12 }}>Подходы: {selectedSetCount} / {selectedPlan.sets}</Text> : null}
            {rankHint && profile ? <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Feather name="award" size={16} color={colors.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                  {rankHint.standard.official ? "Спортивная цель · " : "Расчётный ориентир · "}{rankHint.rank.label}: {formatStandard(rankHint.target, rankHint.standard.unit)}{rankHint.atMaximum ? " · выбранное значение не ниже цели" : ` · ещё ${formatStandard(rankHint.remaining, rankHint.standard.unit)}`}
                </Text>
              </View>
            </View> : null}
            {timed ? <Stepper label="Время удержания" unit="с" value={seconds} disabled={formBusy || !selectedExercise} onChange={value => changeDraft({ durationSeconds: value })} step={5} min={1} max={86400} chips={[15, 30, 45, 60, 90]} /> : <><Stepper
              label={weightLabel(selectedExercise?.equipment)}
              value={weight}
              onChange={value => changeDraft({ weightKg: value })}
              disabled={formBusy || !selectedExercise}
              step={2.5}
              min={selectedExercise ? minimumWeight(selectedExercise.equipment) : 20}
              chips={selectedExercise?.equipment === "bodyweight" ? [0, 5, 10, 15, 20] : selectedExercise?.equipment === "dumbbell" ? [2.5, 5, 10, 15, 20] : [20, 40, 60, 80, 100]}
            />
            <Stepper
              label="Повторения"
              value={reps}
              onChange={value => changeDraft({ reps: value })}
              disabled={formBusy || !selectedExercise}
              step={1}
              min={1}
              chips={[1, 5, 8, 10, 12]}
            /></>}
            <View style={{ minHeight: 16 }}><Text accessibilityLiveRegion="polite" style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 16 }}>{draft.saving ? "Сохранение черновика..." : ""}</Text></View>
            {draft.error ? <View style={{ gap: 8 }}>
              <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>Изменения не сохранены. {draft.error}</Text>
              <Button title="Повторить действие" variant="secondary" disabled={draft.saving} onPress={() => { void draft.retry().catch(() => {}); }} icon={<Feather name="refresh-cw" size={16} color={colors.foreground} />} />
              <Button title="Загрузить сохранённый" variant="ghost" disabled={draft.saving} onPress={() => { void draft.reload().catch(() => {}); }} />
            </View> : null}
            {calibration ? <View style={{ gap: 10, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.cardBorder }}>
              <Text style={{ color: colors.success, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>Подборочный подход</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>Начните с указанного лёгкого веса, без отказа. После подхода отметьте запас и технику. При боли остановитесь; если нагрузка недоступна или слишком тяжёлая, уменьшите её или замените упражнение.</Text>
              <Segmented label="Запас после подхода" value={rir == null ? "unknown" : String(rir)} options={[{ value: "unknown", label: "Не отмечен" }, { value: "0", label: "Нет" }, { value: "2", label: "2–3 повтора" }, { value: "4", label: "4+ повтора" }]} onChange={value => changeDraft({ rir: value === "unknown" ? null : Number(value) })} disabled={formBusy} />
              <Segmented label="Техника после подхода" value={technique ?? "unknown"} options={[{ value: "unknown", label: "Не отмечена" }, { value: "good", label: "Сохранена" }, { value: "breakdown", label: "Нарушалась" }]} onChange={value => changeDraft({ technique: value === "unknown" ? null : value as CoachFields["technique"] })} disabled={formBusy} />
            </View> : null}
            <Button
              size="lg"
              fullWidth
              title={addSet.isPending ? "Добавление..." : "Добавить подход"}
              onPress={handleAddSet}
              disabled={!selectedExercise || formBusy || !!draft.error || !!calibration && (rir == null || technique == null)}
              icon={<Feather name="plus" size={20} color={colors.primaryForeground} />}
            />
            {selectedExercise ? <>
              <AiCoachPanel task="next_set" workoutId={workoutId} disabled={formBusy || !!draft.error} contextKey={`${selectedExerciseId}:${weight}:${reps}:${seconds}:${rir}:${technique}:${workout.sets.length}`} onApplySet={async (answer, context) => {
                const set = answer.result.nextSet;
                if (!set || !context.focus) return;
                await draft.save({ exerciseId: set.exerciseId, weightKg: set.weightKg!, reps: set.reps, ...(set.durationSeconds == null ? {} : { durationSeconds: set.durationSeconds }), rir: null, technique: null }, { revision: context.focus.draftRevision, coachFingerprint: answer.fingerprint });
              }} />
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAssessment }} accessibilityLabel="Оценка подхода" onPress={() => setShowAssessment(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="activity" size={18} color={colors.mutedForeground} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Оценка подхода</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{!timed ? `RIR: ${rir == null ? "не отмечен" : rir === 5 ? "5+" : rir} · ` : ""}Техника: {technique === "good" ? "сохранена" : technique === "breakdown" ? "нарушалась" : "не отмечена"}</Text>
                </View>
                <Feather name={showAssessment ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </Pressable>
              {showAssessment ? <View style={{ gap: 12 }}>
                {!timed ? <Segmented numeric label="Запас повторений (RIR)" value={rir == null ? "unknown" : String(rir)} options={[{ value: "unknown", label: "Не знаю" }, ...[0, 1, 2, 3, 4, 5].map(value => ({ value: String(value), label: value === 5 ? "5+" : String(value) }))]} onChange={value => changeDraft({ rir: value === "unknown" ? null : Number(value) })} disabled={formBusy} /> : null}
                <Segmented label="Качество техники" value={technique ?? "unknown"} options={[{ value: "unknown", label: "Не отмечено" }, { value: "good", label: "Сохранена" }, { value: "breakdown", label: "Нарушалась" }]} onChange={value => changeDraft({ technique: value === "unknown" ? null : value as CoachFields["technique"] })} disabled={formBusy} />
              </View> : null}
            </> : null}
            {rankHint || advice?.weightKg != null ? <>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} accessibilityLabel="Цель и рабочий вес" onPress={() => setShowDetails(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="info" size={18} color={colors.mutedForeground} />
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Цель и рабочий вес</Text>
                <Feather name={showDetails ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </Pressable>
              {showDetails ? <View style={{ gap: 12 }}>
                {rankHint && profile ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rankHint.standard.official ? "WRPF · " : "Расчётный ориентир · "}{profile.sex === "female" ? "Женщины" : "Мужчины"}{rankHint.standard.unit === "kg" ? ` · категория ${weightClass(profile.bodyWeightKg ?? 75, profile.sex ?? "male").label.replace(".", ",")} кг${profile.bodyWeightKg == null ? " (вес не задан)" : ""}` : " · за один подход"}</Text> : null}
                {advice && advice.weightKg != null ? <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{advice.increase ? "Следующий рабочий вес" : "Последний рабочий вес"}: {formatKg(advice.weightKg)}{selectedPlan ? ` · ${selectedPlan.repsMin}-${selectedPlan.repsMax} повт.` : ""}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{advice.reason}</Text>
                  <Button title="Взять рабочий вес" variant="secondary" disabled={formBusy} onPress={() => changeDraft({ weightKg: advice.weightKg! })} icon={<Feather name="arrow-down" size={16} color={colors.foreground} />} />
                </View> : null}
              </View> : null}
            </> : null}
          </View>
        <TrainingTimer workoutId={workoutId} plank={timed && selectedExercise ? { id: selectedExercise.id, name: selectedExercise.name } : undefined} seconds={seconds} restSignal={draft.committedSetId} disabled={formBusy || !!draft.error} onTransfer={draft.transfer} />

        {setsByExercise.map((group) => {
          const planned = planExercises.find(ex => ex.exerciseId === group.exerciseId);
          const completed = planned != null && completedTargets(planned, group.sets) >= planned.sets;
          return (
            <View key={group.exerciseId} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {completed ? <Feather name="check-circle" size={18} color={colors.success} /> : null}
                <Text
                  style={{
                    color: completed ? colors.success : colors.foreground,
                    flex: 1,
                    fontSize: 16,
                    fontFamily: "Inter_700Bold",
                    paddingHorizontal: 4,
                  }}
                >
                  {group.name}
                </Text>
              </View>
              <View style={{ gap: 6 }}>
                {group.sets.map((set, idx) => (
                  <SetCard
                    key={set.id}
                    set={set}
                    index={idx + 1}
                    onDelete={() => { if (!formBusy) deleteSet.mutate({ setId: set.id }); }}
                  />
                ))}
              </View>
            </View>
          );
        })}
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
          disabled={formBusy || !!draft.error || deleteSet.isPending || workout.sets.length === 0}
          icon={<Feather name="check" size={18} color={colors.primaryForeground} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
