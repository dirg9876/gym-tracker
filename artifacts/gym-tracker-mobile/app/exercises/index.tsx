import Feather from "@expo/vector-icons/Feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeleteExercise, useListExercises, type Exercise } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import type { RankedExercise } from "@/lib/exerciseStandards";
import { coachRequest } from "@/lib/coachApi";
import type { ExerciseMaintenance } from "@/lib/exerciseReplacement";
import { exerciseNameKey } from "@/lib/workoutMeasurement";

export default function ExercisesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Exercise | null | undefined>();
  const { data: exercises, isLoading, isError, refetch } = useListExercises();
  const maintenance = useQuery({ queryKey: ["exercise-maintenance"], queryFn: () => coachRequest<ExerciseMaintenance[]>("/api/exercises/maintenance") });
  const pending = maintenance.data?.filter(row => row.exercise.replacementPending) ?? [];
  const remove = useDeleteExercise({
    mutation: {
      onSuccess: () => { client.invalidateQueries(); },
      onError: error => Alert.alert("Не удалось удалить", error instanceof Error ? error.message : "Повторите попытку."),
    },
  });
  const grouped = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    const query = exerciseNameKey(search);
    for (const ex of exercises ?? []) {
      if (!exerciseNameKey(ex.name).includes(query) && !exerciseNameKey(ex.muscleGroup).includes(query)) continue;
      groups.set(ex.muscleGroup, [...(groups.get(ex.muscleGroup) ?? []), ex]);
    }
    return [...groups.entries()];
  }, [exercises, search]);
  const confirmDelete = (ex: Exercise) => {
    const usage = maintenance.data?.find(row => row.exercise.id === ex.id);
    if (!usage) { void maintenance.refetch(); return; }
    if (usage.requiresReplacement) { router.push(`/exercise-replacement?exerciseId=${ex.id}`); return; }
    Alert.alert("Удалить упражнение?", `${ex.name}\nЗаписанных подходов нет. Упражнение будет удалено из каталога, видов и планов тренировок.`, [
    { text: "Отмена", style: "cancel" },
    { text: "Выбрать замену", onPress: () => router.push(`/exercise-replacement?exerciseId=${ex.id}`) },
    { text: "Удалить", style: "destructive", onPress: () => remove.mutate({ exerciseId: ex.id }) },
  ]);
  };
  const iconStyle = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title="Управление упражнениями" onBack={() => router.canGoBack() ? router.back() : router.replace("/programs")} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <Button title="Добавить упражнение" icon={<Feather name="plus" size={18} color={colors.primaryForeground} />} onPress={() => setEditing(null)} />
      {pending.length ? <View style={{ borderLeftWidth: 3, borderColor: colors.primary, paddingLeft: 12, gap: 8 }}><Text style={{ color: colors.foreground, lineHeight: 21 }}>Выберите замену для ранее удалённых упражнений: {pending.length}. Подходы сохранены.</Text>{pending.map(row => <Button key={row.exercise.id} title={row.exercise.name} variant="secondary" icon={<Feather name="repeat" size={17} color={colors.foreground} />} onPress={() => router.push(`/exercise-replacement?exerciseId=${row.exercise.id}`)} />)}</View> : null}
      {maintenance.isError ? <Button title="Повторить проверку упражнений" variant="secondary" onPress={() => { void maintenance.refetch(); }} /> : null}
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 6, borderColor: colors.cardBorder }}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput accessibilityLabel="Поиск упражнения" placeholder="Поиск..." placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} style={{ flex: 1, minWidth: 0, color: colors.foreground, fontSize: 15, minHeight: 48 }} />
      </View>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : isError ? <Button title="Повторить загрузку" variant="secondary" onPress={() => { refetch(); }} /> : grouped.length === 0 ? <Text style={{ color: colors.mutedForeground }}>Ничего не найдено</Text> : grouped.map(([group, list]) => <View key={group}>
        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 8 }}>{group}</Text>
        {list.map(ex => {
          const rank = ex.userRank?.code !== "NONE" ? ex.userRank : null;
          return <View key={ex.id} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.cardBorder, paddingVertical: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={ex.name + ", результаты и нормативы"} onPress={() => router.push(`/exercises/${ex.id}`)} style={{ flex: 1, minHeight: 44, justifyContent: "center", gap: 4, paddingRight: 8 }}>
              <Text style={{ color: rank ? colors.success : colors.foreground, fontSize: 15, fontFamily: "Inter_500Medium" }}>{ex.name}</Text>
              {rank ? <Text style={{ color: colors.success, fontSize: 12 }}>{(ex as RankedExercise).standard?.official ? rank.label : "Ориентир: " + rank.label}</Text> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={"Изменить: " + ex.name} onPress={() => setEditing(ex)} style={iconStyle}><Feather name={ex.isCustom ? "edit-3" : "sliders"} size={18} color={colors.foreground} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={"Заменить: " + ex.name} onPress={() => router.push(`/exercise-replacement?exerciseId=${ex.id}`)} style={iconStyle}><Feather name="repeat" size={18} color={colors.accent} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={"Удалить: " + ex.name} disabled={remove.isPending || maintenance.isPending || maintenance.isError} onPress={() => confirmDelete(ex)} style={iconStyle}><Feather name="trash-2" size={18} color={colors.mutedForeground} /></Pressable>
          </View>;
        })}
      </View>)}
    </ScrollView>
    {editing !== undefined ? <ExerciseEditor exercise={editing} onClose={() => setEditing(undefined)} /> : null}
  </View>;
}
