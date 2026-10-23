import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "@/components/BarChart";
import { Button } from "@/components/Button";
import { ExercisePicker } from "@/components/ExercisePicker";
import { LineChart } from "@/components/LineChart";
import { Segmented } from "@/components/Segmented";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { BodyWeightStats } from "@/components/BodyWeightStats";
import { ExerciseOutlook } from "@/components/ExerciseOutlook";
import type { buildExerciseOutlook } from "@/lib/exerciseOutlook";
import type { bodyWeightForecast } from "@/lib/bodyWeight";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { formatDate, formatNumber, formatShortDate, pluralizeDays } from "@/lib/format";
import { formatStandard } from "@/lib/exerciseStandards";
import type { InsightExercise, InsightSeries, TrainingInsights } from "@/lib/trainingInsights";
import { formatSetResult } from "@/lib/workoutMeasurement";

const dateOf = (key: string) => `${key}T12:00:00`;
const setCount = (value: number) => `${formatNumber(value)} подх.`;
const metricNames = { weight: "Вес", assistance: "Противовес", reps: "Повторы", seconds: "Время" };

function ExerciseInsight({ item }: { item: InsightExercise }) {
  const colors = useColors();
  const router = useRouter();
  const [metric, setMetric] = useState<InsightSeries["id"] | null>(null);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const series = item.series.find(row => row.id === (metric ?? item.defaultMetric)) ?? item.series[0];
  const points = series?.points.slice(-24) ?? [];
  const selectedIndex = points.findIndex(point => point.workoutId === workoutId);
  const selected = points[selectedIndex] ?? points.at(-1);
  return <View style={{ gap: 12 }}>
    {item.series.length > 1 ? <Segmented label="Показатель" value={series.id} options={item.series.map(row => ({ value: row.id, label: metricNames[row.id] }))} onChange={value => { setMetric(value); setWorkoutId(null); }} /> : null}
    {series && selected ? <>
      <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{series.label}</Text>
      <LineChart points={points} height={180} color={colors.accent} label={series.label} formatValue={value => formatStandard(value, series.unit)} selectedIndex={selectedIndex} onSelect={index => setWorkoutId(points[index].workoutId)} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть тренировку ${formatDate(selected.date)}`} onPress={() => router.push(`/history/${selected.workoutId}`)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 10 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>{formatSetResult(selected.set)}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatDate(selected.date)}</Text></View>
        <Feather name="arrow-up-right" size={20} color={colors.accent} />
      </Pressable>
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{points.length < series.points.length ? `Последние ${points.length} из ${series.points.length} тренировок периода` : `Тренировок с результатом: ${points.length}`}</Text>
    </> : <Text style={{ color: colors.mutedForeground }}>Нет измеренных результатов за этот период</Text>}
    {item.unknownTimeSets ? <Text style={{ color: colors.amber, fontSize: 12 }}>Старые подходы без времени: {item.unknownTimeSets}</Text> : null}
    {item.otherCategorySets ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>В истории есть подходы с другой категорией: {item.otherCategorySets}. Они не смешиваются с текущим графиком.</Text> : null}
  </View>;
}

export default function StatsScreen() {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const [period, setPeriod] = useState<"28" | "84" | "all">("28");
  const [exerciseId, setExerciseId] = useState<number>();
  const [outlookId, setOutlookId] = useState<number>();
  const outlook = useQuery({ queryKey: ["progress-outlook"], queryFn: () => coachRequest<{ body: ReturnType<typeof bodyWeightForecast> & { currentKg: number | null }; exercises: ReturnType<typeof buildExerciseOutlook>[] }>("/api/stats/outlook") });
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({ queryKey: ["training-insights", period], queryFn: () => coachRequest<TrainingInsights>(`/api/stats/insights?days=${period}`) });
  useFocusEffect(useCallback(() => { void refetch(); void outlook.refetch(); }, [refetch, outlook.refetch]));
  const selectedOutlook = outlook.data?.exercises.find(row => row.exercise.id === outlookId) ?? outlook.data?.exercises.find(row => !row.calibration) ?? outlook.data?.exercises[0];
  const selected = data?.exercises.find(row => row.exercise.id === exerciseId) ?? data?.exercises[0];
  const section = { borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 20, gap: 14 };
  const title = { color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" };
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 24 }} refreshControl={<RefreshControl refreshing={isRefetching || outlook.isRefetching} tintColor={colors.primary} onRefresh={() => { void refetch(); void outlook.refetch(); }} />}>
    <Segmented label="Период" value={period} options={[{ value: "28", label: "28 дней" }, { value: "84", label: "12 недель" }, { value: "all", label: "Всё время" }]} onChange={setPeriod} />
    {outlook.data ? <>
      <BodyWeightStats body={outlook.data.body} />
      <View style={section}>
        <Text style={title}>Прогноз по упражнениям</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>По всей завершённой истории и текущему плану, независимо от периода графиков</Text>
        {selectedOutlook ? <><ExercisePicker exercises={outlook.data.exercises.map(row => row.exercise)} selectedId={selectedOutlook.exercise.id} onSelect={setOutlookId} /><ExerciseOutlook key={selectedOutlook.exercise.id} outlook={selectedOutlook} compact /></> : <Text style={{ color: colors.mutedForeground }}>Нет доступных упражнений</Text>}
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
      <View style={section}>
        <Text style={title}>Прогресс упражнения</Text>
        {selected ? <>
          <ExercisePicker exercises={data.exercises.map(row => row.exercise)} selectedId={selected.exercise.id} onSelect={setExerciseId} />
          <ExerciseInsight key={selected.exercise.id} item={selected} />
        </> : <Text style={{ color: colors.mutedForeground }}>Нет записанных упражнений за этот период</Text>}
      </View>
      </>}
    </>}
  </ScrollView>;
}
