import { useQuery } from "@tanstack/react-query";
import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { TrainingAnalysis } from "@workspace/ai-coach";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { formatShortDate } from "@/lib/format";
import { formatAnalysisResult } from "@/lib/trainingAnalysis";
import { BarChart } from "./BarChart";
import { ModelForecast } from "./ModelForecast";
import { TrainingBasis } from "./TrainingBasis";

export function WorkoutAnalysis({ workoutId }: { workoutId: number }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const { data, isPending, isError } = useQuery({ queryKey: ["workout-analysis", workoutId], queryFn: () => coachRequest<TrainingAnalysis>(`/api/workouts/${workoutId}/analysis`) });
  if (isPending) return <ActivityIndicator color={colors.primary} />;
  if (isError || !data) return <Text style={{ color: colors.mutedForeground }}>Разбор пока недоступен. Записанные подходы сохранены.</Text>;
  const totals = data.focus?.totals ?? data.totals;
  const body = { color: colors.foreground, fontSize: 14, lineHeight: 21 };
  const muted = { color: colors.mutedForeground, fontSize: 12, lineHeight: 18 };
  const heading = { color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" };
  return <View style={{ gap: 18, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 18 }}>
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Разбор по журналу" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={{ ...heading, fontSize: 18, flex: 1 }}>Разбор по журналу</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={22} color={colors.accent} /></Pressable>
      <Text style={body}>{totals.sets} подх. · {totals.reps} повт.{totals.seconds ? ` · ${totals.seconds} с удержаний` : ""}</Text>
      <Text style={muted}>{totals.repSets ? `Запас отмечен: ${totals.rirKnown}/${totals.repSets}` : "Запас повторений: неприменим"} · техника: {totals.techniqueKnown}/{totals.sets}</Text>
      {totals.failureSets || totals.breakdownSets ? <Text style={{ ...muted, color: colors.amber }}>До отказа: {totals.failureSets} · нарушение техники: {totals.breakdownSets}</Text> : null}
    </View>
    {expanded ? <>
    {totals.repSets ? <View style={{ gap: 12 }}>
      <Text style={heading}>Запас повторений</Text>
      <BarChart bars={[
        { label: "RIR 0 · до отказа", value: totals.rirBuckets[0], color: colors.amber },
        { label: "RIR 1–2", value: totals.rirBuckets[1] + totals.rirBuckets[2], color: colors.success },
        { label: "RIR 3+", value: totals.rirBuckets.slice(3, 6).reduce((sum, n) => sum + n, 0), color: colors.accent },
        { label: "Запас не указан", value: totals.rirBuckets[6], color: colors.mutedForeground },
      ].filter(row => row.value > 0)} formatValue={value => `${value} подх.`} />
    </View> : null}
    <View style={{ gap: 12 }}>
      <Text style={heading}>Нагрузка по мышцам</Text>
      <Text style={muted}>{formatShortDate(`${data.from}T12:00:00`)} – {formatShortDate(`${data.asOf}T12:00:00`)} · тренировок: {data.totals.workouts}</Text>
      <BarChart bars={data.groups.map(row => ({ label: row.name, value: row.sets28, detail: `За 7 дней: ${row.sets7} подх. / ${row.days7} дн. · за 28 дней: ${row.days28} дн.` }))} formatValue={value => `${value} подх.`} color={colors.accent} />
    </View>
    <View style={{ gap: 14 }}>
      <Text style={heading}>Динамика и следующий шаг</Text>
      {data.exercises.map(row => <View key={row.key} style={{ gap: 6, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 12 }}>
        <Text style={{ ...body, fontFamily: "Inter_600SemiBold" }}>{row.name}</Text>
        <Text style={body}>Лучший подход: {formatAnalysisResult(row, false)}</Text>
        {row.comparison ? <Text style={{ ...muted, color: row.comparison.comparableEffort && row.comparison.currentReps > row.comparison.previousReps ? colors.success : colors.mutedForeground }}>{row.assisted ? "Противовес " : ""}{row.comparison.weightKg.toLocaleString("ru-RU")} кг: {row.comparison.previousReps} → {row.comparison.currentReps} повт. · {row.comparison.comparableEffort ? "одинаковый запас, техника сохранена" : "усилие не подтверждено как одинаковое"}</Text> : <Text style={muted}>{row.next.seconds ? "Нет предыдущего сопоставления времени." : "Нет предыдущего сопоставимого подхода с тем же весом."}</Text>}
        {row.matchesCurrentCategory ? <>
          {!row.next.seconds ? <Text style={muted}>{row.range.source === "template" ? "Плановый диапазон" : "Ориентир по цели"}: {row.range.sets} × {row.range.repsMin}{row.range.repsMin !== row.range.repsMax ? `–${row.range.repsMax}` : ""}</Text> : null}
          <Text style={{ ...body, color: row.next.action === "reduce" ? colors.amber : colors.success }}>Следующий ориентир: {formatAnalysisResult(row, true)}</Text>
          <Text style={muted}>{row.next.reason}</Text>
          {row.model ? <ModelForecast model={row.model} perDumbbell={row.equipment === "dumbbell"} /> : null}
        </> : <Text style={{ ...muted, color: colors.amber }}>Категория или число гантелей изменены. Эти результаты сохранены в истории; для нового варианта нужна калибровка.</Text>}
      </View>)}
      {data.omittedExercises ? <Text style={muted}>Других упражнений в периоде: {data.omittedExercises}</Text> : null}
    </View>
    <View style={{ gap: 6 }}><Text style={heading}>Достоверность</Text>{data.limitations.map(text => <Text key={text} style={muted}>{text}</Text>)}</View>
    <TrainingBasis />
    </> : null}
  </View>;
}
