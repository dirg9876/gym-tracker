import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { canReplaceExercise, type CatalogExercise, type ExerciseMaintenance } from "@/lib/exerciseReplacement";

export default function ExerciseReplacementScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const createdReplacement = useRef(false);
  const catalog = useQuery({ queryKey: ["exercise-maintenance"], queryFn: () => coachRequest<ExerciseMaintenance[]>("/api/exercises/maintenance") });
  const source = catalog.data?.find(row => row.exercise.id === Number(exerciseId));
  const replace = useMutation({ mutationFn: (body: object) => coachRequest(`/api/exercises/${exerciseId}/replace`, "POST", body) });
  const candidates = useMemo(() => source ? (catalog.data ?? []).filter(row => canReplaceExercise(source.exercise, row.exercise)
    && `${row.exercise.name} ${row.exercise.muscleGroup}`.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")))
    .sort((a, b) => Number(b.exercise.muscleGroup === source.exercise.muscleGroup) - Number(a.exercise.muscleGroup === source.exercise.muscleGroup) || a.exercise.name.localeCompare(b.exercise.name, "ru")) : [], [source, catalog.data, search]);
  const finish = async () => {
    await client.invalidateQueries();
    if (router.canGoBack()) router.back(); else router.replace("/exercises");
  };
  const choose = (target: CatalogExercise) => Alert.alert("Перенести и заменить?", `${source?.exercise.name} → ${target.name}\nПодходов: ${source?.recordedSets ?? 0}. История и рекорды объединятся. Веса и повторы не изменятся. Уровень пересчитается по выбранному упражнению. Выбирайте одно и то же движение, а не просто похожий тренажёр.`, [
    { text: "Отмена", style: "cancel" },
    { text: "Заменить", onPress: async () => {
      try { await replace.mutateAsync({ targetExerciseId: target.id }); await finish(); }
      catch (error) { Alert.alert("Не удалось заменить", error instanceof Error ? error.message : "Повторите попытку."); }
    } },
  ]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title="Замена упражнения" onBack={() => router.canGoBack() ? router.back() : router.replace("/exercises")} />
    {catalog.isPending ? <ActivityIndicator color={colors.primary} /> : catalog.isError ? <Button title="Повторить загрузку" onPress={() => { void catalog.refetch(); }} /> : !source ? <View style={{ padding: 16, gap: 16 }}><Text style={{ color: colors.mutedForeground }}>Упражнение уже заменено или удалено.</Text><Button title="К упражнениям" onPress={() => router.replace("/exercises")} /></View> : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.foreground, fontSize: 19, lineHeight: 26, fontFamily: "Inter_700Bold" }}>{source.exercise.name}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{source.exercise.muscleGroup} · Подходов: {source.recordedSets}</Text>
      </View>
      <Button title="Создать замену" icon={<Feather name="plus" size={18} color={colors.primaryForeground} />} disabled={replace.isPending} onPress={() => setCreating(true)} />
      <Text style={{ color: colors.accent, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Выбрать из существующих</Text>
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, paddingHorizontal: 12 }}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput accessibilityLabel="Поиск замены" placeholder="Название или группа мышц" placeholderTextColor={colors.mutedForeground} value={search} onChangeText={setSearch} style={{ flex: 1, minWidth: 0, color: colors.foreground, minHeight: 48, fontSize: 15 }} />
      </View>
      {candidates.length ? candidates.map(({ exercise }) => <Pressable key={exercise.id} accessibilityRole="button" accessibilityLabel={"Заменить на: " + exercise.name} disabled={replace.isPending} onPress={() => choose(exercise)} style={{ minHeight: 64, flexDirection: "row", gap: 12, alignItems: "center", borderBottomWidth: 1, borderColor: colors.cardBorder, paddingVertical: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 21 }}>{exercise.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{exercise.muscleGroup}</Text></View>
        <Feather name="arrow-right" size={20} color={colors.primary} />
      </Pressable>) : <Text style={{ color: colors.mutedForeground, lineHeight: 20 }}>Совместимых упражнений не найдено.</Text>}
    </ScrollView>}
    {creating && source ? <ExerciseEditor exercise={null} initialValues={source.exercise} onCreate={async data => { await replace.mutateAsync({ exercise: data }); createdReplacement.current = true; }} onClose={() => { setCreating(false); if (createdReplacement.current) void finish(); }} /> : null}
  </View>;
}
