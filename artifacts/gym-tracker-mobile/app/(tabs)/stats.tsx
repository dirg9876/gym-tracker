import { useGetProgress, useGetStatsOverview } from "@workspace/api-client-react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { WeeklyTraining } from "@/components/WeeklyTraining";
import { LineChart } from "@/components/LineChart";
import { Button } from "@/components/Button";
import { useColors } from "@/hooks/useColors";
import { durationOf, formatSeconds } from "@/lib/workoutMeasurement";
import { formatNumber } from "@/lib/format";

export default function StatsScreen() {
  const colors = useColors();
  const stats = useGetStatsOverview();
  const progress = useGetProgress();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 24 }}>
    <WeeklyTraining />
    <View style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 20, gap: 14 }}>
      <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>За всё время</Text>
      {stats.isLoading || progress.isLoading ? <ActivityIndicator color={colors.primary} /> : stats.isError || progress.isError ? <Button title="Повторить загрузку истории" variant="secondary" onPress={() => { void stats.refetch(); void progress.refetch(); }} /> : <>
        <Text style={{ color: colors.foreground, fontSize: 14 }}>Завершённых тренировок: {stats.data?.totalWorkouts ?? 0}</Text>
        {stats.data && durationOf(stats.data) > 0 ? <Text style={{ color: colors.foreground, fontSize: 14 }}>Удержания: {formatSeconds(durationOf(stats.data))}</Text> : null}
        {progress.data && progress.data.points.length > 0 ? <View style={{ gap: 12 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Повторы по тренировкам</Text>
          <LineChart points={progress.data.points.map(point => ({ date: point.date, value: point.reps }))} color={colors.chart2} formatValue={formatNumber} />
          {progress.data.points.some(point => durationOf(point) > 0) ? <><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Время удержаний по тренировкам</Text><LineChart points={progress.data.points.map(point => ({ date: point.date, value: durationOf(point) }))} color={colors.chart1} formatValue={formatSeconds} /></> : null}
        </View> : null}
      </>}
    </View>
  </ScrollView>;
}
