import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateExercise, useUpdateExercise, useListExercises, type Exercise, type Equipment } from "@workspace/api-client-react";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { MuscleGroupPicker } from "./MuscleGroupPicker";
import { EquipmentPicker } from "./EquipmentPicker";
import { EquipmentSettingsFields } from "./EquipmentSettingsFields";
import { isTimedExercise } from "@/lib/workoutMeasurement";
import type { ConfiguredExercise, EquipmentSettings } from "@/lib/equipmentSettings";
import { useColors } from "@/hooks/useColors";

export function ExerciseEditor({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [name, setName] = useState(exercise?.name ?? "");
  const [group, setGroup] = useState(exercise?.muscleGroup ?? "");
  const [equipment, setEquipment] = useState<Equipment | null>(exercise?.equipment ?? null);
  const [settings, setSettings] = useState<EquipmentSettings>(() => {
    const configured = exercise as ConfiguredExercise | null;
    return { weightStepKg: configured?.weightStepKg ?? 2.5, loadMode: configured?.loadMode ?? "weight", ...(configured?.equipment === "dumbbell" ? { dumbbellCount: configured.dumbbellCount ?? 1 } : {}) };
  });
  const identityEditable = !exercise || exercise.isCustom;
  const create = useCreateExercise();
  const update = useUpdateExercise();
  const { data: exercises } = useListExercises();
  const busy = create.isPending || update.isPending;
  const save = async () => {
    if (!equipment) return;
    try {
      const data = { ...(identityEditable ? { name: name.trim(), muscleGroup: group.trim(), equipment } : {}), weightStepKg: settings.weightStepKg, loadMode: equipment === "machine" ? settings.loadMode : "weight", ...(equipment === "dumbbell" && !isTimedExercise(name) ? { dumbbellCount: settings.dumbbellCount ?? 1 } : {}) };
      if (exercise) await update.mutateAsync({ exerciseId: exercise.id, data });
      else await create.mutateAsync({ data: { ...data, name: name.trim(), muscleGroup: group.trim(), equipment } });
      await client.invalidateQueries();
      onClose();
    } catch (error) {
      Alert.alert("Не удалось сохранить", error instanceof Error ? error.message : "Повторите попытку.");
    }
  };
  const inputStyle = { minHeight: 48, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, paddingHorizontal: 12, color: colors.foreground, fontSize: 16, backgroundColor: colors.card };
  return <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top + 16, backgroundColor: "rgba(0,0,0,0.65)" }}>
      <View style={{ height: "92%", flexShrink: 1, backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.cardBorder, padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Text style={{ flex: 1, color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>{exercise ? "Изменить упражнение" : "Новое упражнение"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть редактор" disabled={busy} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={22} color={colors.foreground} /></Pressable>
        </View>
        <ScrollView style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Название</Text>
          <TextInput accessibilityLabel="Название упражнения" value={name} onChangeText={setName} maxLength={120} editable={!busy && identityEditable} style={inputStyle} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Группа мышц</Text>
          <MuscleGroupPicker value={group} onChange={setGroup} groups={exercises?.map(ex => ex.muscleGroup)} disabled={busy || !identityEditable} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Категория</Text>
          <EquipmentPicker value={equipment} onChange={setEquipment} disabled={busy || !identityEditable} />
          {equipment && !isTimedExercise(name) ? <EquipmentSettingsFields equipment={equipment} value={settings} onChange={setSettings} disabled={busy} /> : null}
        </ScrollView>
        <View style={{ flexShrink: 0 }}><Button title={exercise ? "Сохранить" : "Добавить упражнение"} icon={<Feather name={exercise ? "save" : "plus"} size={18} color={colors.primaryForeground} />} disabled={!name.trim() || !group.trim() || !equipment || busy} loading={busy} onPress={save} /></View>
      </View>
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
}
