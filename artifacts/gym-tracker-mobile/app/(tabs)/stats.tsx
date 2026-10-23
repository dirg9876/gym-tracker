import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "@/components/BarChart";
import { Button } from "@/components/Button";
import { ExercisePicker } from "@/components/ExercisePicker";
import { Segmented } from "@/components/Segmented";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { BodyWeightStats } from "@/components/BodyWeightStats";
import { ExerciseOutlook } from "@/components/ExerciseOutlook";
import { ExerciseProgressChart } from "@/components/ExerciseProgressChart";
import type { buildExerciseOutlook } from "@/lib/exerciseOutlook";
import type { bodyWeightForecast } from "@/lib/bodyWeight";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { formatDate, formatNumber, formatShortDate, pluralizeDays } from "@/lib/format";
import type { InsightExercise, TrainingInsights } from "@/lib/trainingInsights";
import { formatSetContext, formatSetResult, sameLoadCategory } from "@/lib/workoutMeasurement";

const dateOf = (key: string) => `${key}T12:00:00`;
const setCount = (value: number) => `${formatNumber(value)} подх.`;

function ExerciseInsight({ item }: { item: InsightExercise }) {
  const colors = useColors();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const historyPage = Math.min(page, Math.max(0, Math.ceil(item.history.length / 5) - 1));
  return <View style={{ gap: 12 }}>
    {item.unknownTimeSets ? <Text style={{ color: colors.amber, fontSize: 12 }}>Старые подходы без времени: {item.unknownTimeSets}</Text> : null}
    {item.otherCategorySets ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>В истории есть подходы с другой категорией: {item.otherCategorySets}. Они не смешиваются с текущим графиком.</Text> : null}
    <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>Все занятия · {item.history.length}</Text>
    {item.history.slice(historyPage * 5, historyPage * 5 + 5).map(session => <View key={session.workoutId} style={{ gap: 8, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть тренировку ${formatDate(session.date)}`} onPress={() => router.push(`/history/${session.workoutId}`)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{formatDate(session.date)}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{session.sets.length} подх.{session.name ? ` · ${session.name}` : ""}</Text></View>
        <Feather name="arrow-up-right" size={18} color={colors.accent} />
      </Pressable>
      {session.sets.map((set, index) => <View key={set.id} style={{ gap: 3 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Подход {index + 1}</Text><Text style={{ color: colors.foreground, fontSize: 14 }}>{formatSetResult(set)}</Text></View>
        {formatSetContext(set) ? <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{formatSetContext(set)}</Text> : null}
        {!sameLoadCategory(set, item.exercise) ? <Text style={{ color: colors.amber, fontSize: 12 }}>Другая категория в записи · не используется в прогнозе</Text> : null}
      </View>)}
    </View>)}
    {item.history.length > 5 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Более новые занятия упражнения" disabled={historyPage === 0} onPress={() => setPage(historyPage - 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: historyPage === 0 ? 0.35 : 1 }}><Feather name="chevron-left" size={20} color={colors.accent} /></Pressable>
      <Text style={{ flex: 1, textAlign: "center", color: colors.mutedForeground, fontSize: 12 }}>{historyPage * 5 + 1}–{Math.min(item.history.length, historyPage * 5 + 5)} из {item.history.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Более ранние занятия упражнения" disabled={(historyPage + 1) * 5 >= item.history.length} onPress={() => setPage(historyPage + 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: (historyPage + 1) * 5 >= item.history.length ? 0.35 : 1 }}><Feather name="chevron-right" size={20} color={colors.accent} /></Pressable>
    </View> : null}
  </View>;
}

export default function StatsScreen() {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const [period, setPeriod] = useState<"28" | "84" | "all">("28");
  const [exerciseId, setExerciseId] = useState<number>();
  const outlook = useQuery({ queryKey: ["progress-outlook"], queryFn: () => coachRequest<{ body: ReturnType<typeof bodyWeightForecast> & { currentKg: number | null }; exercises: ReturnType<typeof buildExerciseOutlook>[] }>("/api/stats/outlook") });
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({ queryKey: ["training-insights", period], queryFn: () => coachRequest<TrainingInsights>(`/api/stats/insights?days=${period}`) });
  const allHistory = useQuery({ queryKey: ["training-insights", "all"], queryFn: () => coachRequest<TrainingInsights>("/api/stats/insights?days=all") });
  useFocusEffect(useCallback(() => { void refetch(); void outlook.refetch(); void allHistory.refetch(); }, [refetch, outlook.refetch, allHistory.refetch]));
  const selectedId = exerciseId ?? allHistory.data?.exercises[0]?.exercise.id ?? outlook.data?.exercises[0]?.exercise.id;
  const selectedOutlook = outlook.data?.exercises.find(row => row.exercise.id === selectedId);
  const selected = allHistory.data?.exercises.find(row => row.exercise.id === selectedId);
  const section = { borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 20, gap: 14 };
  const title = { color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" };
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 24 }} refreshControl={<RefreshControl refreshing={isRefetching || outlook.isRefetching || allHistory.isRefetching} tintColor={colors.primary} onRefresh={() => { void refetch(); void outlook.refetch(); void allHistory.refetch(); }} />}>
    <Segmented label="Период" value={period} options={[{ value: "28", label: "28 дней" }, { value: "84", label: "12 недель" }, { value: "all", label: "Всё время" }]} onChange={setPeriod} />
    {outlook.data ? <>
      <BodyWeightStats body={outlook.data.body} />
      <View style={section}>
        <Text style={title}>Упражнение · история и прогноз</Text>
        {selectedOutlook ? <><ExercisePicker exercises={outlook.data.exercises.map(row => row.exercise)} selectedId={selectedOutlook.exercise.id} onSelect={setExerciseId} />
          {allHistory.isPending ? <ActivityIndicator color={colors.accent} /> : allHistory.isError ? <Button title="Повторить загрузку истории" variant="secondary" onPress={() => { void allHistory.refetch(); }} /> : <ExerciseProgressChart key={`chart-${selectedId}`} outlook={selectedOutlook} history={selected} />}
          <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>Следующие занятия</Text>
          <ExerciseOutlook key={`forecast-${selectedId}`} outlook={selectedOutlook} compact showChart={false} />
          <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>История за всё время</Text>
          {selected ? <ExerciseInsight key={selectedId} item={selected} /> : allHistory.isPending ? <ActivityIndicator color={colors.accent} /> : allHistory.isError ? <Button title="Повторить загрузку истории" variant="secondary" onPress={() => { void allHistory.refetch(); }} /> : <Text style={{ color: colors.mutedForeground }}>Нет завершённых подходов этого упражнения</Text>}
        </> : <Text style={{ color: colors.mutedForeground }}>Нет доступных упражнений</Text>}
      </View>
    </> : outlook.isError ? <Button title="Повторить загрузку прогнозов" variant="secondary" onPress={() => { void outlook.refetch(); }} /> : <ActivityIndicator color={colors.accent} />}
    {isLoading ? <View style={{ minHeight: 240, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View> : isError || !data ? <Button title="Повторить загрузку статистики" variant="secondary" onPress={() => { void refetch(); }} /> : <>
      <View style={{ gap: 14 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{data.from ? `${formatDate(dateOf(data.from))} - ${formatDate(dateOf(data.to))}` : "За всё время"}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {([{ key: "workouts", label: "Тренировок", color: colors.accent }, { key: "sets", label: "Подходов", color: colors.primary }, { key: "days", label: "Активных дней", color: colors.success }] as const).map(item => <View key={item.key} style={{ flex: 1, minWidth: 84, gap: 6 }}>
            <Text style={{ color: item.color, fontSize: 27, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{formatNumber(data.totals[item.key])}</Text>
            <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 18, minHeight: 36 * Math.max(1, fontScale) }}>{item.label}</Text>
            {data.previous ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Ранее: {formatNumber(data.previous[item.key])}</Text> : null}
          </View>)}
        </View>
        {data.previous && data.period ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Предыдущий период: {data.period} {pluralizeDays(data.period)}</Text> : null}
      </View>
      {data.totals.workouts === 0 ? <View style={{ minHeight: 160, justifyContent: "center", alignItems: "center", gap: 16 }}>
        <Feather name="bar-chart-2" size={32} color={colors.accent} />
        <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>Нет завершённых тренировок за этот период</Text>
      </View> : <>
      {data.calendar.some(day => day.workouts) ? <>
      <View style={section}>
        <Text style={title}>Календарь тренировок</Text>
        <TrainingCalendar days={data.calendar} />
      </View>
      <View style={section}>
        <Text style={title}>Подходы по неделям</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatShortDate(dateOf(data.calendar[0].date))} - {formatShortDate(dateOf(data.to))}</Text>
        {data.calendar.some(day => day.workouts) ? <BarChart bars={data.weeks.map(week => ({ label: `${formatShortDate(dateOf(week.from))} - ${formatShortDate(dateOf(week.to))}`, value: week.sets, detail: `Тренировок: ${week.workouts}${week.partial ? " · неполная неделя" : ""}` }))} color={colors.accent} formatValue={setCount} /> : <Text style={{ color: colors.mutedForeground }}>Нет завершённых тренировок за эти дни</Text>}
      </View>
      </> : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>За последние 12 недель нет завершённых тренировок</Text>}
      <View style={section}>
        <Text style={title}>Подходы по основным группам</Text>
        {data.groups.length ? <BarChart bars={data.groups.map((group, index) => ({ label: group.muscleGroup, value: group.sets, detail: `Дней с нагрузкой: ${group.days}`, color: index % 2 ? colors.accent : colors.primary }))} formatValue={setCount} /> : <Text style={{ color: colors.mutedForeground }}>Нет записанных подходов за этот период</Text>}
      </View>
      </>}
    </>}
  </ScrollView>;
}
