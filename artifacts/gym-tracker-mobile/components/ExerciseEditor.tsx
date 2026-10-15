import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateExercise, useUpdateExercise, useListExercises, type Exercise, type Equipment } from "@workspace/api-client-react";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { MuscleGroupPicker } from "./MuscleGroupPicker";
import { useColors } from "@/hooks/useColors";

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: "barbell", label: "Штанга" }, { value: "dumbbell", label: "Гантели" },
  { value: "bodyweight", label: "Собственный вес" }, { value: "machine", label: "Тренажёр" },
  { value: "other", label: "Другое" },
];

export function ExerciseEditor({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [name, setName] = useState(exercise?.name ?? "");
  const [group, setGroup] = useState(exercise?.muscleGroup ?? "");
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? "other");
  const create = useCreateExercise();
  const update = useUpdateExercise();
  const { data: exercises } = useListExercises();
  const busy = create.isPending || update.isPending;
  const save = async () => {
    try {
      const data = { name: name.trim(), muscleGroup: group.trim(), equipment };
      if (exercise) await update.mutateAsync({ exerciseId: exercise.id, data });
      else await create.mutateAsync({ data });
      await client.invalidateQueries();
      onClose();
    } catch (error) {
      Alert.alert("Не удалось сохранить", error instanceof Error ? error.message : "Повторите попытку.");
    }
  };
  const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, paddingHorizontal: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.card };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top + 16, backgroundColor: "rgba(0,0,0,0.65)" }}>
      <View style={{ flexShrink: 1, maxHeight: "95%", backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.cardBorder, padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Text style={{ flex: 1, color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>{exercise ? "Изменить упражнение" : "Новое упражнение"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть редактор" disabled={busy} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Название</Text>
          <TextInput accessibilityLabel="Название упражнения" value={name} onChangeText={setName} maxLength={120} editable={!busy} style={inputStyle} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Группа мышц</Text>
          <MuscleGroupPicker value={group} onChange={setGroup} groups={exercises?.map(ex => ex.muscleGroup)} disabled={busy} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Оборудование</Text>
          <View accessibilityRole="radiogroup">
            {EQUIPMENT.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: equipment === option.value }} disabled={busy} onPress={() => setEquipment(option.value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Feather name={equipment === option.value ? "check-circle" : "circle"} size={20} color={equipment === option.value ? colors.primary : colors.mutedForeground} />
              <Text style={{ color: colors.foreground, fontSize: 15 }}>{option.label}</Text>
            </Pressable>)}
          </View>
        </ScrollView>
        <View style={{ flexShrink: 0 }}><Button title={exercise ? "Сохранить" : "Добавить упражнение"} icon={<Feather name={exercise ? "save" : "plus"} size={18} color={colors.primaryForeground} />} disabled={!name.trim() || !group.trim() || busy} loading={busy} onPress={save} /></View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
