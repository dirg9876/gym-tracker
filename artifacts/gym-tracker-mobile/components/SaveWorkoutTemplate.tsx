import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { getListProgramsQueryKey, useCreateCustomProgram, useListExercises, type Workout } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from "react-native";
import { Button } from "./Button";
import { useColors } from "@/hooks/useColors";
import { templateFromWorkout } from "@/lib/workoutTemplates";
import { sameLoadCategory, type MeasuredSet } from "@/lib/workoutMeasurement";

export function SaveWorkoutTemplate({ workout }: { workout: Workout }) {
  const colors = useColors();
  const router = useRouter();
  const client = useQueryClient();
  const create = useCreateCustomProgram();
  const { data: available } = useListExercises();
  const savedSets = workout.sets.filter(set => available?.some(item => item.id === set.exerciseId));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workout.name || `Тренировка ${new Date(workout.startedAt).toLocaleDateString("ru-RU")}`);
  const save = async () => {
    try {
      if (savedSets.some(set => !sameLoadCategory(set as MeasuredSet, available!.find(item => item.id === set.exerciseId)!))) throw new Error("Категория упражнения изменена. Старые веса нельзя перенести на другое оборудование. Создайте шаблон с новыми весами в разделе тренировок.");
      const data = { name: name.trim(), description: `Из тренировки ${new Date(workout.startedAt).toLocaleDateString("ru-RU")}`, exercises: templateFromWorkout({ ...workout, sets: savedSets }) };
      const result = await create.mutateAsync({ data });
      await client.invalidateQueries({ queryKey: getListProgramsQueryKey() });
      setOpen(false);
      router.push(`/programs/${result.id}`);
    } catch (error) { Alert.alert("Не удалось сохранить шаблон", error instanceof Error ? error.message : "Повторите попытку."); }
  };
  return <>
    <Button title="Сохранить как шаблон" variant="secondary" icon={<Feather name="save" size={18} color={colors.foreground} />} disabled={!workout.finishedAt || savedSets.length === 0} onPress={() => setOpen(true)} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!create.isPending) setOpen(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.75)" }}>
        <View style={{ padding: 20, gap: 16, borderRadius: 8, backgroundColor: colors.card }}>
          <Text style={{ fontSize: 20, color: colors.foreground, fontFamily: "Inter_700Bold" }}>Шаблон тренировки</Text>
          <TextInput accessibilityLabel="Название шаблона" maxLength={80} value={name} onChangeText={setName} editable={!create.isPending} placeholder="Название" placeholderTextColor={colors.mutedForeground} style={{ minHeight: 48, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.cardBorder, color: colors.foreground, fontSize: 16 }} />
          <Button title="Сохранить" icon={<Feather name="save" size={18} color={colors.primaryForeground} />} onPress={save} loading={create.isPending} disabled={!name.trim()} />
          <Button title="Отмена" variant="secondary" disabled={create.isPending} onPress={() => setOpen(false)} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
