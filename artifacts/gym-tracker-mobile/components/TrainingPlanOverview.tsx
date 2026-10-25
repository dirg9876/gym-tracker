import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { getGetActiveWorkoutQueryKey, getListExercisesQueryKey, useGetActiveWorkout, useListExercises } from "@workspace/api-client-react";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Button } from "./Button";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import type { monthProgress } from "@/lib/coachMonth";
import type { DailyPreview } from "@/lib/dailyWorkout";
import type { ConfiguredExercise } from "@/lib/equipmentSettings";
import { formatDate } from "@/lib/format";
import { planExerciseLines } from "@/lib/planSummary";

export function TrainingPlanOverview() {
  const colors = useColors(), router = useRouter();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const active = useGetActiveWorkout({ query: { queryKey: getGetActiveWorkoutQueryKey(), enabled: focused, refetchOnMount: "always" } });
  const preview = useQuery({ queryKey: ["daily-workout", "auto"], queryFn: () => coachRequest<DailyPreview>("/api/daily-workout"), enabled: focused && active.isSuccess && !active.data.workout, refetchOnMount: "always" });
  const month = useQuery({ queryKey: ["coach-month"], queryFn: () => coachRequest<ReturnType<typeof monthProgress>>("/api/ai-coach/month"), enabled: focused, refetchOnMount: "always" });
  const catalog = useListExercises({ query: { queryKey: getListExercisesQueryKey(), enabled: focused && active.isSuccess && !active.data.workout && !!preview.data?.plan } });
  const refresh = () => { void active.refetch(); void month.refetch(); if (active.isSuccess && !active.data.workout) void preview.refetch(); };
  const workout = active.data?.workout, plan = preview.data?.plan;
  const title = { color: colors.foreground, fontSize: 17, lineHeight: 24, fontFamily: "Inter_700Bold" };
  const muted = { color: colors.mutedForeground, fontSize: 13, lineHeight: 20 };
  const section = { gap: 12, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 16 };
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }} refreshControl={<RefreshControl refreshing={active.isRefetching || preview.isRefetching || month.isRefetching} tintColor={colors.primary} onRefresh={refresh} />}>
    {active.isError ? <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ ...muted, color: colors.amber }}>Не удалось проверить текущую тренировку.</Text><Button title="Повторить загрузку" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void active.refetch(); }} /></View>
      : workout ? <View style={{ gap: 12 }}>
        <Text style={{ color: colors.success, fontSize: 12 }}>Сейчас</Text><Text style={title}>{workout.name || "Самостоятельная тренировка"}</Text><Text style={muted}>{workout.totalSets} подх. · {new Set(workout.sets.map(set => set.exerciseId)).size} упр.</Text>
        <Button title="Открыть тренировку" icon={<Feather name="arrow-right" size={18} color={colors.primaryForeground} />} onPress={() => router.push(`/workout/${workout.id}`)} />
      </View> : active.isPending || preview.isPending ? <ActivityIndicator color={colors.primary} /> : preview.isError ? <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ ...muted, color: colors.amber }}>Не удалось обновить ближайший план.</Text><Button title="Обновить план" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void preview.refetch(); }} /></View> : <View style={{ gap: 12 }}>
        <Text style={title}>Ближайшее занятие</Text>
        {plan ? <>
          <Text style={{ color: colors.accent, fontSize: 12 }}>{formatDate(`${preview.data!.date}T12:00:00`)} · {preview.data?.source === "month" ? `Месячный план · неделя ${preview.data.scheduled?.week ?? 1}` : "Расчёт программы"}</Text>
          <Text style={{ ...title, fontSize: 16 }}>{plan.name}</Text>
          <Text style={muted}>{plan.exercises.length} упр. · {plan.exercises.some(ex => ex.postCalibrationSets) ? "до " : ""}{plan.exercises.reduce((sum, ex) => sum + ex.sets + (ex.postCalibrationSets ?? 0), 0)} подх.</Text>
          {catalog.isError ? <Button title="Обновить параметры упражнений" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void catalog.refetch(); }} /> : null}
          {plan.exercises.map(ex => {
            const configured = catalog.data?.find(item => item.id === ex.exerciseId) as ConfiguredExercise | undefined;
            return <Pressable key={ex.exerciseId} accessibilityRole="button" accessibilityLabel={`${ex.name}, история и прогноз`} onPress={() => router.push(`/exercises/${ex.exerciseId}?view=progress`)} style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21, fontFamily: "Inter_600SemiBold" }}>{ex.name}</Text>{configured ? planExerciseLines(ex, configured).map((line, index) => <Text key={index} style={muted}>{line}</Text>) : catalog.isPending ? <ActivityIndicator color={colors.accent} /> : <Text style={{ ...muted, color: colors.amber }}>Параметры упражнения недоступны</Text>}{ex.calibration ? <Text style={{ ...muted, color: colors.amber }}>Подборочный подход{ex.postCalibrationSets ? ` · затем ещё ${ex.postCalibrationSets} по оценке` : ""}</Text> : null}</View><Feather name="chevron-right" size={18} color={colors.accent} />
            </Pressable>;
          })}
        </> : <Text style={muted}>Нет упражнений для выбранного оборудования.</Text>}
      </View>}
    <View style={section}>
      <Pressable accessibilityRole="button" accessibilityLabel="Месячный план" onPress={() => router.push("/coach-month")} style={{ minHeight: 56, flexDirection: "row", gap: 10, alignItems: "center" }}><Feather name="calendar" size={20} color={colors.accent} /><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={title}>Месячный план</Text>{month.data ? <Text style={muted}>{month.data.saved.plan.name} · {month.data.slots.filter(slot => slot.completed).length}/{month.data.slots.length} занятий</Text> : month.isPending ? <ActivityIndicator color={colors.accent} /> : !month.isError ? <Text style={muted}>Не сохранён</Text> : null}</View><Feather name="chevron-right" size={18} color={colors.accent} /></Pressable>
      {month.isError ? <Button title="Обновить месячный план" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void month.refetch(); }} /> : null}
    </View>
  </ScrollView>;
}
