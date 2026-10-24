import Feather from "@expo/vector-icons/Feather";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BarChart } from "@/components/BarChart";
import { BodyWeightStats } from "@/components/BodyWeightStats";
import { Button } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { TrainingCalendar } from "@/components/TrainingCalendar";
import { WeeklyTraining } from "@/components/WeeklyTraining";
import { useColors } from "@/hooks/useColors";
import type { bodyWeightForecast } from "@/lib/bodyWeight";
import { coachRequest } from "@/lib/coachApi";
import { formatDate, formatNumber, formatShortDate, pluralizeDays } from "@/lib/format";
import type { TrainingInsights } from "@/lib/trainingInsights";

type StatsView = "overview" | "load" | "body";
type BodyWeightData = ReturnType<typeof bodyWeightForecast> & { currentKg: number | null };
const dateOf = (key: string) => `${key}T12:00:00`;
const setCount = (value: number) => `${formatNumber(value)} подх.`;

export default function StatsScreen() {
  const colors = useColors();
  const client = useQueryClient();
  const { fontScale } = useWindowDimensions();
  const [period, setPeriod] = useState<"28" | "84" | "all">("28");
  const [view, setView] = useState<StatsView>("overview");
  const insights = useQuery({
    queryKey: ["training-insights", period],
    queryFn: () => coachRequest<TrainingInsights>(`/api/stats/insights?days=${period}`),
    enabled: view === "overview",
  });
  const bodyWeight = useQuery({
    queryKey: ["body-weight-stats"],
    queryFn: () => coachRequest<BodyWeightData>("/api/stats/body-weight"),
    enabled: view === "body",
  });
  const weeklyFetching = useIsFetching({ queryKey: ["coach-weekly"], exact: true });
  const { refetch: refetchInsights } = insights;
  const { refetch: refetchBodyWeight } = bodyWeight;
  const refreshVisible = useCallback(() => {
    if (view === "overview") void refetchInsights({ cancelRefetch: false });
    else if (view === "body") void refetchBodyWeight({ cancelRefetch: false });
    else void client.invalidateQueries({ queryKey: ["coach-weekly"], exact: true }, { cancelRefetch: false });
  }, [view, refetchInsights, refetchBodyWeight, client]);
  useFocusEffect(useCallback(() => {
    // WeeklyTraining refreshes its own query on focus.
    if (view !== "load") refreshVisible();
  }, [view, refreshVisible]));
  const refreshing = view === "overview" ? insights.isRefetching : view === "body" ? bodyWeight.isRefetching : weeklyFetching > 0;
  const { data } = insights;
  const section = { borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 16, gap: 12 };
  const title = { color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" };

  return <ScrollView key={view} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={refreshVisible} />}>
    <Segmented label="Статистика" value={view} options={[{ value: "overview", label: "Обзор" }, { value: "load", label: "Нагрузка" }, { value: "body", label: "Вес тела" }]} onChange={setView} />
    {view === "overview" ? <>
      <Segmented label="Период сводки" value={period} options={[{ value: "28", label: "28 дней" }, { value: "84", label: "84 дня" }, { value: "all", label: "Всё время" }]} onChange={setPeriod} />
      {insights.isError ? <View style={{ gap: 10 }}>
        <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>Не удалось {data ? "обновить" : "загрузить"} статистику.</Text>
        <Button title="Повторить загрузку статистики" variant="secondary" loading={insights.isFetching} icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={refreshVisible} />
      </View> : null}
      {data ? <>
        <View style={{ gap: 12 }}>
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
        </View> : data.calendar.some(day => day.workouts) ? <>
          <View style={section}>
            <Text style={title}>Календарь тренировок</Text>
            {period === "all" ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Последние 12 недель</Text> : null}
            <TrainingCalendar days={data.calendar} />
          </View>
          <View style={section}>
            <Text style={title}>Подходы по неделям</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatShortDate(dateOf(data.calendar[0].date))} - {formatShortDate(dateOf(data.to))}</Text>
            <BarChart bars={data.weeks.map(week => ({ label: `${formatShortDate(dateOf(week.from))} - ${formatShortDate(dateOf(week.to))}`, value: week.sets, detail: `Тренировок: ${week.workouts}${week.partial ? " · неполная неделя" : ""}` }))} color={colors.accent} formatValue={setCount} />
          </View>
        </> : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>За последние 12 недель нет завершённых тренировок</Text>}
      </> : !insights.isError ? <View style={{ minHeight: 160, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View> : null}
    </> : null}
    {view === "load" ? <WeeklyTraining /> : null}
    {view === "body" ? <>
      {bodyWeight.isError ? <View style={{ gap: 10 }}>
        <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>Не удалось {bodyWeight.data ? "обновить" : "загрузить"} данные о весе тела.</Text>
        <Button title="Повторить загрузку веса тела" variant="secondary" loading={bodyWeight.isFetching} icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={refreshVisible} />
      </View> : null}
      {bodyWeight.data ? <BodyWeightStats body={bodyWeight.data} /> : !bodyWeight.isError ? <View style={{ minHeight: 160, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View> : null}
    </> : null}
  </ScrollView>;
}
