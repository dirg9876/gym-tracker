import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { getGetActiveWorkoutQueryKey, getGetProgramPlanQueryKey, getListProgramsQueryKey, getListWorkoutsQueryKey, useCreateWorkout, useCreateCustomProgram, useDeleteCustomProgram, useGetActiveWorkout, useUpdateCustomProgram, useListExercises } from "@workspace/api-client-react";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { ScreenHeader } from "./ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { isTimedExercise, minimumWeight, weightLabel } from "@/lib/workoutMeasurement";
import { editableTemplateExercise, templateInputErrors, withSetTargets, type TemplatePlan, type SetTarget } from "@/lib/workoutTemplates";
import { ExercisePicker } from "./ExercisePicker";
import { returnToBrand } from "@/lib/navigation";

export function SavedWorkoutPlan({ plan, onSaved, confirmation }: { plan: TemplatePlan; onSaved?: () => void; confirmation?: { title: string; label: string; apply: (plan: TemplatePlan) => Promise<void> } }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useQueryClient();
  const isNew = plan.id === "new";
  const { data: catalog } = useListExercises();
  const [name, setName] = useState(plan.name);
  const [exercises, setExercises] = useState(() => plan.exercises.map(editableTemplateExercise));
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateCustomProgram();
  const add = useCreateCustomProgram();
  const remove = useDeleteCustomProgram();
  const create = useCreateWorkout();
  const { data: active } = useGetActiveWorkout();
  const busy = confirming || update.isPending || add.isPending || remove.isPending || create.isPending;
  const data = { name: name.trim(), description: plan.description, exercises };
  const errors = templateInputErrors(data);
  const valid = Object.keys(errors).length === 0;
  const changeSets = (index: number, targets: SetTarget[]) => {
    setExercises(previous => previous.map((ex, i) => {
      if (i !== index) return ex;
      return withSetTargets(ex, targets, true);
    }));
    setDirty(true);
  };
  const showError = (error: unknown) => Alert.alert("Не удалось выполнить действие", error instanceof Error ? error.message : "Повторите попытку.");
  const save = async () => {
    if (!valid || busy) return;
    try {
      if (confirmation) {
        setConfirming(true);
        await confirmation.apply({ ...plan, ...data });
        setDirty(false);
        onSaved?.();
        return;
      }
      const result = isNew ? await add.mutateAsync({ data }) : await update.mutateAsync({ programId: plan.id, data });
      await client.invalidateQueries({ queryKey: getGetProgramPlanQueryKey(plan.id) });
      await client.invalidateQueries({ queryKey: getListProgramsQueryKey() });
      setDirty(false);
      onSaved?.();
      if (isNew) router.replace(`/programs/${result.id}`);
    } catch (error) { showError(error); }
    finally { setConfirming(false); }
  };
  const back = useCallback(() => {
    if (busy) return;
    const leave = () => confirmation ? router.back() : router.replace("/programs");
    if (!dirty) { leave(); return; }
    Alert.alert("Несохранённые изменения", "Уйти без сохранения?", [{ text: "Остаться", style: "cancel" }, { text: "Уйти", style: "destructive", onPress: leave }]);
  }, [dirty, router, busy, confirmation]);
  const home = () => {
    if (busy) return;
    if (!dirty) { returnToBrand(); return; }
    Alert.alert("Несохранённые изменения", "Уйти без сохранения?", [{ text: "Остаться", style: "cancel" }, { text: "Уйти", style: "destructive", onPress: returnToBrand }]);
  };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => subscription.remove();
  }, [back]));
  const move = (index: number, delta: number) => {
    setExercises(previous => { const rows = [...previous]; [rows[index], rows[index + delta]] = [rows[index + delta], rows[index]]; return rows; });
    setDirty(true);
  };
  const start = async () => {
    if (active?.workout) { router.replace(`/workout/${active.workout.id}`); return; }
    try {
      const input = { name: plan.name, programId: plan.id };
      const workout = await create.mutateAsync({ data: input });
      await client.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
      await client.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      router.replace(`/workout/${workout.id}`);
    } catch (error) { showError(error); }
  };
  const deleteTemplate = () => Alert.alert("Удалить шаблон?", "История тренировок останется.", [
    { text: "Отмена", style: "cancel" },
    { text: "Удалить", style: "destructive", onPress: async () => {
      try {
        await remove.mutateAsync({ programId: plan.id });
        await client.invalidateQueries({ queryKey: getListProgramsQueryKey() });
        router.replace("/programs");
      } catch (error) { showError(error); }
    } },
  ]);
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title={confirmation?.title ?? (isNew ? "Новый вид тренировки" : "Вид тренировки")} onBack={back} onHome={home} />
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 24 }}>
      <TextInput accessibilityLabel="Название шаблона" placeholder="Название тренировки" placeholderTextColor={colors.mutedForeground} maxLength={80} editable={!busy} value={name} onChangeText={value => { setName(value); setDirty(true); }} style={{ minHeight: 48, borderBottomWidth: 1, borderColor: colors.cardBorder, color: colors.foreground, fontSize: 18 }} />
      <FieldError message={errors.name} />
      <ExercisePicker disabled={busy} exercises={(catalog ?? []).filter(ex => !exercises.some(row => row.exerciseId === ex.id))} selectedId={undefined} onSelect={id => {
        const ex = catalog?.find(row => row.id === id);
        if (!ex) return;
        const timed = isTimedExercise(ex.name);
        const target: SetTarget = timed ? { weightKg: 0, reps: 0, durationSeconds: 30, setType: "working" } : { weightKg: minimumWeight(ex.equipment) || (ex.equipment === "bodyweight" ? 0 : 2.5), reps: 8, setType: "working" };
        setExercises(previous => [...previous, { exerciseId: ex.id, name: ex.name, muscleGroup: ex.muscleGroup, equipment: ex.equipment, isBodyweight: ex.equipment === "bodyweight", basedOn: "level-benchmark", suggestedWeightKg: target.weightKg, sets: 3, repsMin: timed ? 30 : 8, repsMax: timed ? 30 : 12, intent: "hypertrophy", note: null, weightStepKg: ex.equipment === "dumbbell" ? 1 : 2.5, targetRir: 2, setTargets: Array.from({ length: 3 }, () => ({ ...target })) }]);
        setDirty(true);
      }} />
      <FieldError message={errors.exercises} />
      {exercises.map((ex, index) => {
        const timed = isTimedExercise(ex.name);
        const path = `exercises.${index}`;
        return <View key={ex.exerciseId} style={{ gap: 12, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>{ex.name}</Text>
            {([[-1, "arrow-up"], [1, "arrow-down"], [0, "trash-2"]] as const).map(([delta, icon]) => <Pressable key={icon} accessibilityRole="button" accessibilityLabel={`${delta < 0 ? "Выше" : delta > 0 ? "Ниже" : "Удалить упражнение"}: ${ex.name}`} disabled={busy || (delta < 0 && index === 0) || (delta > 0 && index === exercises.length - 1)} onPress={() => { if (delta) move(index, delta); else { setExercises(previous => previous.filter((_, i) => i !== index)); setDirty(true); } }} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center", opacity: (delta < 0 && index === 0) || (delta > 0 && index === exercises.length - 1) ? 0.25 : 1 }}><Feather name={icon} size={18} color={colors.mutedForeground} /></Pressable>)}
          </View>
          <FieldError message={errors[`${path}.exerciseId`]} />
          {ex.note ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{ex.note}</Text> : null}
          {!timed ? <View style={{ gap: 6 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Прогрессия рабочих подходов</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {([['repsMin', 'Повторы от', ex.repsMin], ['repsMax', 'Повторы до', ex.repsMax], ['weightStepKg', 'Шаг, кг', ex.weightStepKg ?? 2.5], ['targetRir', 'Запас', ex.targetRir ?? 2]] as const).map(([key, label, value]) => <View key={key} style={{ flexGrow: 1, flexBasis: "45%", gap: 4 }}><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{label}</Text><NumberField label={`${ex.name}: ${label}`} error={errors[`${path}.${key}`]} value={value} disabled={busy} onChange={value => { setExercises(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row)); setDirty(true); }} /></View>)}
            </View>
          </View> : null}
          <View style={{ flexDirection: "row", gap: 8, paddingLeft: 28, paddingRight: 40 }}>
            {!timed ? <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{weightLabel(ex.equipment)}</Text> : null}
            <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{timed ? "Время, с" : "Повторы"}</Text>
          </View>
          {ex.setTargets!.map((set, setIndex) => {
            const change = (values: Partial<SetTarget>) => changeSets(index, ex.setTargets!.map((row, i) => i === setIndex ? { ...row, ...values } : row));
            return <View key={setIndex} style={{ gap: 6 }}><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Text style={{ color: colors.mutedForeground, width: 20 }}>{setIndex + 1}</Text>
              {!timed ? <NumberField label={`${ex.name}, подход ${setIndex + 1}, вес`} error={errors[`${path}.setTargets.${setIndex}.weightKg`]} value={set.weightKg} onChange={value => change({ weightKg: value })} disabled={busy} /> : null}
              <NumberField label={`${ex.name}, подход ${setIndex + 1}, ${timed ? "секунды" : "повторы"}`} error={errors[`${path}.setTargets.${setIndex}.${timed ? "durationSeconds" : "reps"}`]} value={timed ? set.durationSeconds! : set.reps} onChange={value => change(timed ? { durationSeconds: value } : { reps: value })} disabled={busy} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Удалить подход ${setIndex + 1}: ${ex.name}`} disabled={busy || ex.setTargets!.length === 1} onPress={() => changeSets(index, ex.setTargets!.filter((_, i) => i !== setIndex))} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center", opacity: ex.setTargets!.length === 1 ? 0.3 : 1 }}><Feather name="trash-2" size={18} color={colors.mutedForeground} /></Pressable>
            </View><FieldError message={errors[`${path}.setTargets.${setIndex}`]} /></View>;
          })}
          <FieldError message={errors[`${path}.setTargets`]} />
          <Button title="Добавить подход" variant="ghost" icon={<Feather name="plus" size={16} color={colors.foreground} />} disabled={busy} onPress={() => changeSets(index, [...ex.setTargets!, { ...ex.setTargets!.at(-1)! }])} />
        </View>;
      })}
      {dirty || isNew ? <Button title={confirmation?.label ?? "Сохранить вид тренировки"} icon={<Feather name={confirmation ? "check" : "save"} size={18} color={colors.primaryForeground} />} onPress={save} disabled={!valid || busy} loading={confirming || update.isPending || add.isPending} /> : null}
      {!isNew ? <Button title="Удалить вид тренировки" variant="ghost" icon={<Feather name="trash-2" size={18} color={colors.foreground} />} onPress={deleteTemplate} disabled={busy} /> : null}
    </ScrollView>
    {!isNew ? <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderColor: colors.cardBorder }}>
      <Button title={active?.workout ? "Открыть текущую тренировку" : "Начать тренировку"} onPress={start} disabled={busy || dirty || !valid} loading={create.isPending} icon={<Feather name="play" size={18} color={colors.primaryForeground} />} />
    </View> : null}
  </KeyboardAvoidingView>;
}

function FieldError({ message }: { message?: string }) {
  const colors = useColors();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 12 }}>{message}</Text> : null;
}

function NumberField({ label, value, onChange, disabled, error }: { label: string; value: number; onChange: (value: number) => void; disabled: boolean; error?: string }) {
  const colors = useColors();
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  const parse = (input: string) => input.trim() === "" ? NaN : Number(input.replace(",", "."));
  useEffect(() => { if (!Object.is(parse(text), value)) setText(Number.isFinite(value) ? String(value) : ""); }, [value, text]);
  return <View style={{ flex: 1, minWidth: 0, gap: 4 }}><TextInput accessibilityLabel={label} accessibilityHint={error} value={text} editable={!disabled} keyboardType="decimal-pad" selectTextOnFocus onChangeText={input => { setText(input); onChange(parse(input)); }} style={{ minHeight: 48, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: error ? colors.amber : colors.cardBorder, backgroundColor: colors.card, color: colors.foreground, fontSize: 16 }} /><FieldError message={error} /></View>;
}
