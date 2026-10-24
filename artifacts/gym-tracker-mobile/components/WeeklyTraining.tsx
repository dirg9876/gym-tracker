import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import type { weeklyWork } from "@/lib/trainingCoach";
import { Button } from "./Button";
import type { MuscleWorkload } from "@/lib/muscleWorkload";
import { formatNumber } from "@/lib/format";

type Group = ReturnType<typeof weeklyWork>[number];
export function WeeklyTraining() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["coach-weekly"], queryFn: () => coachRequest<MuscleWorkload & { groups: Group[]; exercises: Array<Group & { exerciseId: number; name: string }> }>("/api/stats/weekly") });
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  return <View style={{ gap: 14 }}>
    <View style={{ gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>Нагрузка за 7 дней</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{start.toLocaleDateString("ru-RU")} - {end.toLocaleDateString("ru-RU")}</Text></View>
    {isLoading ? <ActivityIndicator color={colors.primary} /> : isError ? <Button title="Повторить загрузку" variant="secondary" onPress={() => { void refetch(); }} /> : !data?.groups.length ? <Text style={{ color: colors.mutedForeground }}>Нет завершённых тренировок за эти дни</Text> : <>
      {data.muscles.map(group => <View key={group.muscle} style={{ gap: 7, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}><Text style={{ flex: 1, minWidth: 120, color: colors.foreground, fontSize: 14 }}>{group.label}</Text><Text style={{ color: colors.success, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{formatNumber(group.estimatedSets)} усл. подх.</Text></View>
        <View style={{ height: 6, flexDirection: "row", backgroundColor: colors.muted, overflow: "hidden", borderRadius: 2 }}>
          <View style={{ width: `${100 * group.direct / Math.max(1, ...data.muscles.map(row => row.estimatedSets))}%`, backgroundColor: colors.primary }} />
          <View style={{ width: `${100 * group.indirect * 0.5 / Math.max(1, ...data.muscles.map(row => row.estimatedSets))}%`, backgroundColor: colors.accent }} />
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Прямые: {group.direct} · косвенные: {group.indirect} · дней: {group.days}{group.holds ? ` · удержания: ${group.holds}` : ""}</Text>
      </View>)}
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>Прямой подход = 1, косвенный = 0,5. Это условный учёт записанной работы, не измерение роста или восстановления. Стабилизация и удержания не приравнены к динамическим подходам.</Text>
      {data.unspecifiedSets ? <Text style={{ color: colors.amber, fontSize: 12 }}>Подходы без уточнённой мышечной карты: {data.unspecifiedSets}. Они сохранены в упражнениях ниже, но не распределены по мышцам.</Text> : null}
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL("https://pubmed.ncbi.nlm.nih.gov/41343037/"); }} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name="external-link" size={15} color={colors.accent} /><Text style={{ color: colors.accent, fontSize: 12, flex: 1 }}>Pelland и соавт., 2026 · учёт косвенных подходов</Text></Pressable>
      <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>Упражнения за неделю</Text>
      {data.exercises.map(ex => <Pressable key={ex.exerciseId} accessibilityRole="button" accessibilityLabel={`Прогресс: ${ex.name}`} onPress={() => router.push(`/exercises/${ex.exerciseId}?view=progress`)} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: 8 }}><Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>{ex.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ex.workingSets} подх.</Text><Feather name="chevron-right" size={16} color={colors.mutedForeground} /></Pressable>)}
    </>}
  </View>;
}
