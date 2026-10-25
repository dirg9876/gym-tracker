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
import { ExerciseWeightStep } from "@/components/ExerciseWeightStep";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { SetCard } from "@/components/SetCard";
import { SetEditor } from "@/components/SetEditor";
import type { EditableSet } from "@/lib/setEditing";
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
  const [editingSet, setEditingSet] = useState<EditableSet | null>(null);
  const [showPerformed, setShowPerformed] = useState(false);
  const [showWeightStep, setShowWeightStep] = useState(false);
  const [stepSaving, setStepSaving] = useState(false);
  useEffect(() => { setShowWeightStep(false); }, [selectedExerciseId]);
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
    void draft.save({ ...current, ...values }, undefined, { ...("rir" in values ? { rir: values.rir != null } : {}), ...("technique" in values ? { technique: values.technique != null } : {}) }).catch(() => {});
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
  }, [workoutId, exercises, workout?.sets]));

  // Legacy active plans have no draft yet; never overwrite a restored draft.
  useEffect(() => {
    if (!workout || workout.finishedAt || !draft.ready || draft.saving || draft.error || !planLoaded || draft.value) return;
    const next = planExercises.find(ex => completedTargets(ex, workout.sets) < ex.sets);
    const exercise = exercises?.find(ex => ex.id === next?.exerciseId);
    if (next && exercise) void draft.save(makeWorkoutDraft(exercise, plannedSet(next, completedTargets(next, workout.sets)))).catch(() => {});
  }, [workout, draft, planLoaded, planExercises, exercises]);

  const addSet = useMutation({
      mutationFn: () => draft.commit(),
      onSuccess: async () => {
        const plan = await loadPlan(workoutId);
        setPlanExercises((plan?.exercises ?? []).filter(ex => exercises?.some(item => item.id === ex.exerciseId)));
        setPlanLoaded(true);
        toast.show("success", "Подход добавлен");
      },
      onError: (error) => toast.show("error", error instanceof Error ? error.message : "Не удалось добавить подход"),
  });

  const deleteSet = useDeleteSet({
    mutation: {
      onError: error => toast.show("error", error instanceof Error ? error.message : "Не удалось удалить подход"),
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
  const formBusy = !draft.ready || draft.saving || addSet.isPending || deleteSet.isPending || finishWorkout.isPending || deleting || !!editingSet || stepSaving;
  const inherited = (!timed && rir != null && !draft.assessment.rir) || (technique != null && !draft.assessment.technique);

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

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title={workout.name || "Тренировка"} subtitle={`${workout.totalSets} подх. · ${uniqueExercises} упр.`} onBack={returnToBrand} right={<DeleteWorkoutButton workoutId={workoutId} name={workout.name || "Тренировка"} disabled={formBusy} onPendingChange={setDeleting} onDeleted={returnToBrand} />} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
      <ExercisePicker profile={profile} exercises={exercises || []} selectedId={selectedExerciseId} disabled={formBusy || !planLoaded} onSelect={selectExercise} onCreate={(name, muscleGroup, equipment, settings) => createExercise.mutateAsync({ data: { name, muscleGroup, equipment, ...settings } })} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Следующий подход #{workout.sets.filter(s => s.exerciseId === selectedExerciseId).length + 1}</Text>
        {selectedPlan ? <Text style={{ color: selectedSetCount >= selectedPlan.sets ? colors.success : colors.accent, fontSize: 12 }}>Выполнено {selectedSetCount} из {selectedPlan.sets}</Text> : null}
      </View>
      {timed ? <Stepper label="Время удержания" unit="с" value={seconds} disabled={formBusy || !selectedExercise} onChange={value => changeDraft({ durationSeconds: value })} step={5} min={1} max={86400} chips={[15, 30, 45, 60, 90]} /> : <>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Stepper compact label={assisted ? "Противовес (кг)" : weightLabel(selectedExercise?.equipment)} value={weight} onChange={value => changeDraft({ weightKg: value })} disabled={formBusy || !selectedExercise} step={weightStep(selectedExercise)} min={selectedExercise ? minimumWeight(selectedExercise.equipment) : 20} max={assisted ? profile?.bodyWeightKg ?? 500 : undefined} /></View>
          <View style={{ flex: 1, minWidth: 0 }}><Stepper compact label={selectedExercise?.equipment === "dumbbell" && selectedExercise.dumbbellCount === 2 ? "Повторения на руку" : "Повторения"} value={reps} onChange={value => changeDraft({ reps: value })} disabled={formBusy || !selectedExercise} step={1} min={1} /></View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{weightPresets(selectedExercise, profile?.bodyWeightKg).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${assisted ? "Противовес" : weightLabel(selectedExercise?.equipment)}: ${value}`} accessibilityState={{ selected: weight === value, disabled: formBusy || !selectedExercise }} disabled={formBusy || !selectedExercise} onPress={() => changeDraft({ weightKg: value })} style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 4, backgroundColor: weight === value ? colors.primary : colors.card, borderWidth: 1, borderColor: weight === value ? colors.primary : colors.cardBorder }}><Text style={{ color: weight === value ? colors.primaryForeground : colors.mutedForeground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{formatNumber(value)}</Text></Pressable>)}</View>
      </>}
      {selectedExercise && !timed ? <View style={{ gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Изменить шаг веса" accessibilityState={{ expanded: showWeightStep, disabled: formBusy || !!draft.error }} disabled={formBusy || !!draft.error} onPress={() => setShowWeightStep(value => !value)} onLongPress={() => toast.show("info", "Изменить шаг веса")} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name="sliders" size={17} color={colors.accent} /><Text style={{ flex: 1, color: colors.accent, fontSize: 13 }}>Шаг: {formatKg(weightStep(selectedExercise))}</Text><Feather name={showWeightStep ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} /></Pressable>
        {showWeightStep ? <ExerciseWeightStep key={selectedExercise.id} exercise={selectedExercise} disabled={formBusy || !!draft.error} onPendingChange={setStepSaving} onSaved={() => setShowWeightStep(false)} /> : null}
      </View> : null}
      {selectedExercise?.equipment === "dumbbell" && !timed ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{selectedExercise.dumbbellCount === 2 ? `Две гантели · суммарно ${formatKg(weight * 2)}` : "Одна гантель"}</Text> : null}
      {(selectedExercise?.equipment === "bodyweight" || assisted) && !timed ? profile?.bodyWeightKg != null
        ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Масса тела {formatKg(profile.bodyWeightKg)} · нагрузка {formatKg(assisted ? Math.max(0, profile.bodyWeightKg - weight) : profile.bodyWeightKg + weight)}</Text>
        : <Button title="Указать вес тела" variant="ghost" disabled={formBusy} icon={<Feather name="user" size={16} color={colors.foreground} />} onPress={() => router.push("/levels")} /> : null}
      {prediction && !timed && !assisted ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={{ flex: 1, color: colors.success, fontSize: 14, lineHeight: 21, fontFamily: "Inter_600SemiBold" }}>Цель: {selectedExercise?.equipment === "bodyweight" ? "+" : ""}{formatKg(prediction.next.weightKg)} × {prediction.next.reps}</Text>
        {weight !== prediction.next.weightKg || reps !== prediction.next.reps ? <Pressable accessibilityRole="button" accessibilityLabel="Применить расчёт" disabled={formBusy || !!draft.error} onPress={() => changeDraft({ weightKg: prediction.next.weightKg, reps: prediction.next.reps })} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="check" size={20} color={colors.success} /></Pressable> : null}
      </View> : null}
      {calibration ? <Text style={{ color: colors.amber, fontSize: 12, lineHeight: 18 }}>Подборочный подход · после выполнения нужны запас и техника.</Text> : null}
      {selectedExercise ? <View style={{ gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAssessment || !!calibration }} accessibilityLabel="Оценка подхода" disabled={formBusy} onPress={() => setShowAssessment(v => !v)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="activity" size={18} color={inherited ? colors.amber : technique === "good" ? colors.success : colors.accent} />
          <View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.foreground, fontSize: 13 }}>{!timed ? `Запас: ${rir == null ? "не отмечен" : rir === 5 ? "5+" : rir} · ` : ""}Техника: {technique === "good" ? "сохранена" : technique === "breakdown" ? "нарушалась" : "не отмечена"}</Text>{inherited ? <Text style={{ color: colors.amber, fontSize: 11 }}>Оценка перенесена · не подтверждена</Text> : null}</View>
          <Feather name={showAssessment || calibration ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </Pressable>
        {showAssessment || calibration ? <View style={{ gap: 10 }}>
          {!timed ? <Segmented numeric label="Запас повторений (RIR)" value={rir == null ? "unknown" : String(rir)} options={[{ value: "unknown", label: "Не знаю" }, ...[0, 1, 2, 3, 4, 5].map(value => ({ value: String(value), label: value === 5 ? "5+" : String(value) }))]} onChange={value => changeDraft({ rir: value === "unknown" ? null : Number(value) })} disabled={formBusy} /> : null}
          <Segmented label="Качество техники" value={technique ?? "unknown"} options={[{ value: "unknown", label: "Не отмечено" }, { value: "good", label: "Сохранена" }, { value: "breakdown", label: "Нарушалась" }]} onChange={value => changeDraft({ technique: value === "unknown" ? null : value as CoachFields["technique"] })} disabled={formBusy} />
        </View> : null}
        {(rir != null && !timed || technique != null) ? <Pressable accessibilityRole="checkbox" accessibilityLabel="Оценка подхода актуальна" accessibilityState={{ checked: !inherited, disabled: formBusy }} disabled={formBusy} onPress={() => { if (draft.value) void draft.save(draft.value, undefined, { rir: !timed && rir != null && inherited, technique: technique != null && inherited }).catch(() => {}); }} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name={inherited ? "square" : "check-square"} size={20} color={inherited ? colors.amber : colors.success} /><Text style={{ flex: 1, color: colors.foreground, fontSize: 13 }}>Оценка актуальна</Text></Pressable> : null}
      </View> : null}
      <TrainingTimer compact workoutId={workoutId} plank={timed && selectedExercise ? { id: selectedExercise.id, name: selectedExercise.name } : undefined} seconds={seconds} restSignal={draft.committedSetId} disabled={formBusy || !!draft.error} onTransfer={draft.transfer} />
      {draft.saving ? <Text accessibilityLiveRegion="polite" style={{ color: colors.mutedForeground, fontSize: 11 }}>Сохранение...</Text> : null}
      {draft.error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>{draft.error}</Text><Button title="Повторить действие" variant="secondary" disabled={draft.saving} onPress={() => { void draft.retry().catch(() => {}); }} icon={<Feather name="refresh-cw" size={16} color={colors.foreground} />} /><Button title="Загрузить сохранённый" variant="ghost" disabled={draft.saving} onPress={() => { void draft.reload().catch(() => {}); }} /></View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="План и расчёты" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(v => !v)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="info" size={18} color={colors.accent} /><Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>План и расчёты</Text><Feather name={showDetails ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} /></Pressable>
      {showDetails ? <View style={{ gap: 12 }}>
        {selectedExerciseId ? <><PreviousExerciseSets key={selectedExerciseId} exerciseId={selectedExerciseId} /><Pressable accessibilityRole="button" accessibilityLabel="Мышцы и техника выбранного упражнения" onPress={() => router.push(`/exercises/${selectedExerciseId}`)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="info" size={17} color={colors.accent} /><Text style={{ flex: 1, color: colors.accent, fontSize: 13 }}>Мышцы и техника</Text><Feather name="chevron-right" size={16} color={colors.accent} /></Pressable></> : null}
        {prediction && !timed && !assisted ? <><Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>{prediction.next.reason}</Text><ModelForecast model={prediction.model} perDumbbell={selectedExercise?.equipment === "dumbbell"} /></> : null}
        {rankHint && profile ? <Text style={{ color: colors.accent, fontSize: 12, lineHeight: 19 }}>{rankHint.standard.official ? "Спортивная цель · " : "Расчётный ориентир · "}{rankHint.rank.label}: {formatStandard(rankHint.target, rankHint.standard.unit)}{rankHint.atMaximum ? " · достигнут" : ` · ещё ${formatStandard(rankHint.remaining, rankHint.standard.unit)}`}{rankHint.standard.unit === "kg" ? ` · категория ${weightClass(profile.bodyWeightKg ?? 75, profile.sex ?? "male").label} кг` : ""}</Text> : null}
        {planExercises.map(ex => { const done = completedTargets(ex, workout.sets); return <Pressable key={ex.exerciseId} accessibilityRole="button" accessibilityLabel={`Выбрать: ${ex.name}`} disabled={formBusy} onPress={() => selectExercise(ex.exerciseId)} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name={done >= ex.sets ? "check-circle" : "circle"} size={17} color={done >= ex.sets ? colors.success : colors.mutedForeground} /><Text style={{ flex: 1, color: done >= ex.sets ? colors.success : colors.foreground, fontSize: 13 }}>{ex.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{done}/{ex.sets}</Text></Pressable>; })}
        {aiConnection.data?.enabled ? <Button title="Написать тренеру" variant="secondary" disabled={formBusy || !!draft.error} icon={<Feather name="message-circle" size={18} color={colors.success} />} onPress={() => router.push(`/coach-session?workoutId=${workoutId}`)} /> : null}
        {selectedExercise && !assisted ? <AiCoachPanel task="next_set" workoutId={workoutId} disabled={formBusy || !!draft.error} contextKey={`${selectedExerciseId}:${weight}:${reps}:${seconds}:${rir}:${technique}:${draft.assessment.rir}:${draft.assessment.technique}:${workout.sets.length}`} onApplySet={async (answer, context) => { const set = answer.result.nextSet; if (!set || !context.focus) return; const exercise = exercises?.find(ex => ex.id === set.exerciseId); if (!exercise) return; await draft.save(makeWorkoutDraft(exercise, { weightKg: set.weightKg!, reps: set.reps, ...(set.durationSeconds == null ? {} : { durationSeconds: set.durationSeconds }) }, draft.value?.exerciseId === set.exerciseId ? draft.value : undefined), { revision: context.focus.draftRevision, coachFingerprint: answer.fingerprint }); }} /> : null}
      </View> : null}
      {workout.sets.length ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Выполненные подходы" accessibilityState={{ expanded: showPerformed }} onPress={() => setShowPerformed(v => !v)} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name="check-circle" size={18} color={colors.success} /><Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>Выполненные подходы · {workout.totalSets}</Text><Feather name={showPerformed ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} /></Pressable>
        {showPerformed ? setsByExercise.map(group => <View key={group.exerciseId} style={{ gap: 8 }}><Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{group.name}</Text>{group.sets.map((set, idx) => <SetCard key={set.id} set={set} index={idx + 1} disabled={formBusy} onEdit={() => setEditingSet(set as EditableSet)} onDelete={() => { if (!formBusy) deleteSet.mutate({ setId: set.id }); }} />)}</View>) : null}
      </> : null}
    </ScrollView>
    <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.cardBorder, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Button style={{ flex: 1 }} size="lg" title={addSet.isPending ? "Добавление..." : "Добавить подход"} onPress={handleAddSet} disabled={!selectedExercise || formBusy || !!draft.error || assisted && profile?.bodyWeightKg == null || !!calibration && (rir == null || technique == null || !draft.assessment.rir || !draft.assessment.technique)} icon={<Feather name="plus" size={20} color={colors.primaryForeground} />} /><Pressable accessibilityRole="button" accessibilityLabel="Завершить тренировку" accessibilityState={{ disabled: formBusy || !!draft.error || workout.sets.length === 0 }} disabled={formBusy || !!draft.error || workout.sets.length === 0} onPress={handleFinish} onLongPress={() => toast.show("info", "Завершить тренировку")} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", opacity: formBusy || workout.sets.length === 0 ? 0.5 : 1 }}><Feather name="check-circle" size={24} color={colors.success} /></Pressable></View>
    </View>
    {editingSet ? <SetEditor key={editingSet.id} set={editingSet} onClose={() => setEditingSet(null)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
