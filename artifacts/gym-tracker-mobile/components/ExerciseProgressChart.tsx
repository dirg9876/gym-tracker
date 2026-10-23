import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/hooks/useColors";
import type { ExerciseOutlook } from "@/lib/exerciseOutlook";
import { buildExerciseTimeline, type ExerciseTimelinePoint } from "@/lib/exerciseTimeline";
import type { InsightExercise, InsightSeries } from "@/lib/trainingInsights";
import { formatDate, formatKg } from "@/lib/format";
import { formatStandard } from "@/lib/exerciseStandards";
import { formatSeconds, formatSetResult } from "@/lib/workoutMeasurement";
import { LineChart } from "./LineChart";
import { Segmented } from "./Segmented";

const metricNames = { weight: "Вес", assistance: "Противовес", reps: "Повторы", seconds: "Время" };
const pointKey = (point: ExerciseTimelinePoint) => point.kind === "history" ? `history-${point.workoutId}` : `forecast-${point.date}`;

export function ExerciseProgressChart({ outlook, history }: { outlook: ExerciseOutlook; history?: InsightExercise }) {
  const colors = useColors(), router = useRouter();
  const [metric, setMetric] = useState<InsightSeries["id"] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const timeline = buildExerciseTimeline(outlook, history, metric);
  const { points, forecastStartIndex } = timeline;
  const found = points.findIndex(point => pointKey(point) === selectedKey);
  const selectedIndex = found >= 0 ? found : forecastStartIndex >= 0 ? forecastStartIndex : points.length - 1;
  const selected = points[selectedIndex];
  const result = (point: ExerciseTimelinePoint) => {
    if (point.kind === "history") return formatSetResult(point.set);
    const target = point.session.targets[0];
    return outlook.timed ? formatSeconds(target.durationSeconds ?? 0) : `${outlook.assisted ? "Противовес " : outlook.exercise.equipment === "bodyweight" ? "+" : ""}${formatKg(target.weightKg)} × ${target.reps}`;
  };
  return <View style={{ gap: 12 }}>
    {timeline.metrics.length > 1 ? <Segmented label="Показатель" value={timeline.metric.id} options={timeline.metrics.map(row => ({ value: row.id, label: metricNames[row.id] }))} onChange={value => { setMetric(value); setSelectedKey(null); }} /> : null}
    <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>{timeline.metric.label} · за всё время</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 18, borderTopWidth: 2, borderColor: colors.accent }} /><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Факт · лучший подход</Text></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 18, borderTopWidth: 2, borderColor: colors.success, borderStyle: "dashed" }} /><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>План · первый подход</Text></View>
    </View>
    {selected ? <>
      <LineChart points={points} color={colors.accent} forecastColor={colors.success} height={180} zeroBaseline={false} minimumSpan={timeline.minimumSpan} forecastStartIndex={forecastStartIndex}
        label="Вся история упражнения и условный прогноз" formatValue={value => formatStandard(value, timeline.metric.unit)} formatPoint={index => result(points[index])}
        selectedIndex={selectedIndex} onSelect={index => setSelectedKey(pointKey(points[index]))} />
      {selected.kind === "history" ? <Pressable accessibilityRole="button" accessibilityLabel={`Открыть тренировку ${formatDate(selected.date)}`} onPress={() => router.push(`/history/${selected.workoutId}`)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>Факт · {formatDate(selected.date)}</Text><Feather name="arrow-up-right" size={18} color={colors.accent} />
      </Pressable> : <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>План · {selected.session.targets.length} подх. · {selected.session.conditional ? "при успешном выполнении предыдущих занятий" : "ближайший ориентир"}</Text>}
    </> : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Пока нет измеренных результатов для графика</Text>}
  </View>;
}
