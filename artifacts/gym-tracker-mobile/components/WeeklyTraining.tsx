import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import type { weeklyWork } from "@/lib/trainingCoach";
import { Button } from "./Button";

type Group = ReturnType<typeof weeklyWork>[number];
export function WeeklyTraining() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["coach-weekly"], queryFn: () => coachRequest<{ groups: Group[]; exercises: Array<Group & { exerciseId: number; name: string }> }>("/api/stats/weekly") });
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
  return <View style={{ gap: 14 }}>
    <View style={{ gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>Нагрузка за 7 дней</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{start.toLocaleDateString("ru-RU")} - {end.toLocaleDateString("ru-RU")}</Text></View>
    {isLoading ? <ActivityIndicator color={colors.primary} /> : isError ? <Button title="Повторить загрузку" variant="secondary" onPress={() => { void refetch(); }} /> : !data?.groups.length ? <Text style={{ color: colors.mutedForeground }}>Нет завершённых тренировок за эти дни</Text> : <>
      <View style={{ flexDirection: "row", gap: 8 }}><Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>Основная группа</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, width: 76, textAlign: "right" }}>Подходы</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, width: 56, textAlign: "right" }}>Дни</Text></View>
      {data.groups.map(group => <View key={group.muscleGroup} style={{ gap: 6, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
        <View style={{ flexDirection: "row", gap: 8 }}><Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>{group.muscleGroup}</Text><Text style={{ color: colors.success, width: 76, textAlign: "right", fontSize: 16 }}>{group.workingSets}</Text><Text style={{ color: colors.foreground, width: 56, textAlign: "right", fontSize: 16 }}>{group.trainingDays}</Text></View>
      </View>)}
      <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>Упражнения за неделю</Text>
      {data.exercises.map(ex => <Pressable key={ex.exerciseId} accessibilityRole="button" accessibilityLabel={`Прогресс: ${ex.name}`} onPress={() => router.push(`/exercises/${ex.exerciseId}`)} style={{ flexDirection: "row", alignItems: "center", minHeight: 48, gap: 8 }}><Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>{ex.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ex.workingSets} подх.</Text><Feather name="chevron-right" size={16} color={colors.mutedForeground} /></Pressable>)}
    </>}
  </View>;
}
