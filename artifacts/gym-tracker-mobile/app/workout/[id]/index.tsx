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
import { PreviousExerciseSets } from "@/components/PreviousExerciseSets";
import { ModelForecast } from "@/components/ModelForecast";
import type { buildActivePrediction } from "@/lib/trainingPrediction";
import { isAssisted, weightStep, weightPresets, type ConfiguredExercise } from "@/lib/equipmentSettings";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";
import { returnToBrand } from "@/lib/navigation";
import { loadPlan } from "@/lib/programPlanStash";
import { durationOf, formatSeconds, isTimedExercise, minimumWeight, weightLabel } from "@/lib/workoutMeasurement";
import { exerciseRankHint } from "@/lib/rankHint";
import { formatStandard } from "@/lib/exerciseStandards";
import { completedTargets, plannedSet, type TemplateExercise } from "@/lib/workoutTemplates";
import type { CoachFields } from "@/lib/trainingCoach";
import { coachRequest } from "@/lib/coachApi";
import { makeWorkoutDraft, selectWorkoutDraft, type WorkoutDraft } from "@/lib/workoutDraft";
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
  const calibration = !isAssisted(exercises?.find(ex => ex.id === selectedExerciseId)) && planExercises.find(ex => ex.exerciseId === selectedExerciseId)?.calibration && !workout?.sets.some(set => set.exerciseId === selectedExerciseId);
  const selectedExercise = exercises?.find(exercise => exercise.id === selectedExerciseId) as ConfiguredExercise | undefined;
  const { data: prediction } = useQuery({ queryKey: ["training-prediction", workoutId, selectedExerciseId, workout?.sets.map(set => set.id).join(":")],
    queryFn: () => coachRequest<ReturnType<typeof buildActivePrediction>>(`/api/workouts/${workoutId}/prediction/${selectedExerciseId}`), enabled: !!selectedExerciseId && !!workout && !workout.finishedAt });
  const timed = isTimedExercise(selectedExercise?.name ?? "");
  const { data: profile } = useGetProfile();
  const assisted = isAssisted(selectedExercise);
  const rankHint = assisted && profile?.bodyWeightKg == null ? null : exerciseRankHint(selectedExercise, profile, timed ? seconds : selectedExercise?.equipment === "bodyweight" ? reps : assisted ? Math.max(0, (profile?.bodyWeightKg ?? 0) - weight) : weight);
  const selectExercise = (id: number) => {
    const exercise = exercises?.find(item => item.id === id);
    if (!exercise || !draft.ready || draft.saving || draft.value?.exerciseId === id) return;
    const planned = planExercises.find(item => item.exerciseId === id);
    void draft.save(selectWorkoutDraft(exercise, planned ? plannedSet(planned, completedTargets(planned, workout?.sets ?? [])) : undefined, draft.value, workout?.sets ?? [])).catch(() => {});
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
        queryClient.invalidateQueries({ queryKey: ["previous-workout"] });
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
          backgroundColor: colors.card,
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
                fontSize: 10,
                fontFamily: "Inter_700Bold",
                letterSpacing: 0,
                textTransform: "uppercase",
              }}
            >
              {s.l}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={{
                color: s.l === "Подходы" ? colors.accent : colors.foreground,
                fontSize: 17,
                fontFamily: "Inter_700Bold",
                fontVariant: ["tabular-nums"],
                marginTop: 4,
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
              onCreate={(name, muscleGroup, equipment, settings) =>
                createExercise.mutateAsync({ data: { name, muscleGroup, equipment, ...settings } })
              }
            />
            {selectedExerciseId ? <PreviousExerciseSets key={selectedExerciseId} exerciseId={selectedExerciseId} /> : null}
            {selectedPlan ? <Text style={{ color: selectedSetCount >= selectedPlan.sets ? colors.success : colors.mutedForeground, fontSize: 12 }}>Подходы: {selectedSetCount} / {selectedPlan.sets}</Text> : null}
            {rankHint && profile ? <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", paddingVertical: 6 }}>
              <Feather name="award" size={16} color={colors.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.accent, fontSize: 12, lineHeight: 18, fontFamily: "Inter_500Medium" }}>
                  {rankHint.standard.official ? "Спортивная цель · " : "Расчётный ориентир · "}{rankHint.rank.label}: {formatStandard(rankHint.target, rankHint.standard.unit)}{rankHint.atMaximum ? " · выбранное значение не ниже цели" : ` · ещё ${formatStandard(rankHint.remaining, rankHint.standard.unit)}`}
                </Text>
              </View>
            </View> : null}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>СЛЕДУЮЩИЙ ПОДХОД</Text>
              {selectedExerciseId ? <Text style={{ color: colors.accent, fontSize: 13, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>#{workout.sets.filter(set => set.exerciseId === selectedExerciseId).length + 1}</Text> : null}
            </View>
            {timed ? <Stepper label="Время удержания" unit="с" value={seconds} disabled={formBusy || !selectedExercise} onChange={value => changeDraft({ durationSeconds: value })} step={5} min={1} max={86400} chips={[15, 30, 45, 60, 90]} /> : <>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}><View style={{ flex: 1, minWidth: 0 }}><Stepper compact
              label={assisted ? "Противовес (кг)" : weightLabel(selectedExercise?.equipment)}
              value={weight}
              onChange={value => changeDraft({ weightKg: value })}
              disabled={formBusy || !selectedExercise}
              step={weightStep(selectedExercise)}
              min={selectedExercise ? minimumWeight(selectedExercise.equipment) : 20}
              max={assisted ? profile?.bodyWeightKg ?? 500 : undefined}
            /></View><View style={{ flex: 1, minWidth: 0 }}>
            <Stepper compact
              label={selectedExercise?.equipment === "dumbbell" && selectedExercise.dumbbellCount === 2 ? "Повторения на руку" : "Повторения"}
              value={reps}
              onChange={value => changeDraft({ reps: value })}
              disabled={formBusy || !selectedExercise}
              step={1}
              min={1}
            /></View></View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{weightPresets(selectedExercise, profile?.bodyWeightKg).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${assisted ? "Противовес" : weightLabel(selectedExercise?.equipment)}: ${value}`} accessibilityState={{ selected: weight === value, disabled: formBusy || !selectedExercise }} disabled={formBusy || !selectedExercise} onPress={() => changeDraft({ weightKg: value })} style={{ minWidth: 44, minHeight: 36, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: weight === value ? colors.primary : colors.card, borderWidth: 1, borderColor: weight === value ? colors.primary : colors.cardBorder }}><Text style={{ color: weight === value ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{formatNumber(value)}</Text></Pressable>)}</View>
            </>}
            {selectedExercise?.equipment === "dumbbell" && !timed ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{selectedExercise.dumbbellCount === 2 ? `Две гантели · суммарно ${formatKg(weight * 2)}` : "Одна гантель"}</Text> : null}
            {(selectedExercise?.equipment === "bodyweight" || assisted) && !timed ? profile?.bodyWeightKg != null
              ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Вес тела: {formatKg(profile.bodyWeightKg)} · {assisted ? "Расчётная" : "Общая"} нагрузка: {formatKg(assisted ? Math.max(0, profile.bodyWeightKg - weight) : profile.bodyWeightKg + weight)}</Text>
              : <Button title="Указать вес тела" variant="ghost" disabled={formBusy} icon={<Feather name="user" size={16} color={colors.foreground} />} onPress={() => router.push("/levels")} /> : null}
            {prediction && prediction.model.status !== "unsupported" ? <View style={{ gap: 8, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.cardBorder }}>
              <Text style={{ color: colors.success, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Расчёт нагрузки: {formatKg(prediction.next.weightKg)} × {prediction.next.reps}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>{prediction.next.reason}</Text>
              {prediction.model.note !== prediction.next.reason || prediction.model.status === "ready" ? <ModelForecast model={prediction.model} perDumbbell={selectedExercise?.equipment === "dumbbell"} /> : null}
              <Button title="Применить расчёт" variant="secondary" disabled={formBusy || !!draft.error} icon={<Feather name="check" size={16} color={colors.foreground} />} onPress={() => changeDraft({ weightKg: prediction.next.weightKg, reps: prediction.next.reps })} />
            </View> : null}
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
            {selectedExercise ? <>
              {!assisted ? <AiCoachPanel task="next_set" workoutId={workoutId} disabled={formBusy || !!draft.error} contextKey={`${selectedExerciseId}:${weight}:${reps}:${seconds}:${rir}:${technique}:${workout.sets.length}`} onApplySet={async (answer, context) => {
                const set = answer.result.nextSet;
                if (!set || !context.focus) return;
                const exercise = exercises?.find(ex => ex.id === set.exerciseId);
                if (!exercise) return;
                await draft.save(makeWorkoutDraft(exercise, { weightKg: set.weightKg!, reps: set.reps, ...(set.durationSeconds == null ? {} : { durationSeconds: set.durationSeconds }) }, draft.value?.exerciseId === set.exerciseId ? draft.value : undefined), { revision: context.focus.draftRevision, coachFingerprint: answer.fingerprint });
              }} /> : aiConnection.data?.enabled ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Противовес подбирается вручную; ИИ не меняет его.</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAssessment }} accessibilityLabel="Оценка подхода" onPress={() => setShowAssessment(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="activity" size={18} color={technique === "good" ? colors.success : technique === "breakdown" ? colors.amber : colors.mutedForeground} />
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
            {rankHint ? <>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} accessibilityLabel="Цель и рабочий вес" onPress={() => setShowDetails(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="info" size={18} color={colors.mutedForeground} />
                <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Цель и рабочий вес</Text>
                <Feather name={showDetails ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
              </Pressable>
              {showDetails ? <View style={{ gap: 12 }}>
                {rankHint && profile ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rankHint.standard.official ? "WRPF · " : "Расчётный ориентир · "}{profile.sex === "female" ? "Женщины" : "Мужчины"}{rankHint.standard.unit === "kg" ? ` · категория ${weightClass(profile.bodyWeightKg ?? 75, profile.sex ?? "male").label.replace(".", ",")} кг${profile.bodyWeightKg == null ? " (вес не задан)" : ""}` : " · за один подход"}</Text> : null}
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
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Button style={{ flex: 1 }} size="lg" title={addSet.isPending ? "Добавление..." : "Добавить подход"} onPress={handleAddSet} disabled={!selectedExercise || formBusy || !!draft.error || assisted && profile?.bodyWeightKg == null || !!calibration && (rir == null || technique == null)} icon={<Feather name="plus" size={20} color={colors.primaryForeground} />} />
          <Pressable accessibilityRole="button" accessibilityLabel="Завершить тренировку" accessibilityState={{ disabled: formBusy || !!draft.error || workout.sets.length === 0 }} disabled={formBusy || !!draft.error || workout.sets.length === 0} onPress={handleFinish} onLongPress={() => toast.show("info", "Завершить тренировку")} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", opacity: formBusy || workout.sets.length === 0 ? 0.5 : 1 }}><Feather name="check-circle" size={24} color={colors.success} /></Pressable>
        </View>
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
