import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { ExerciseOutlook as Outlook } from "@/lib/exerciseOutlook";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { LineChart } from "./LineChart";

export function ExerciseOutlook({ outlook, compact = false, showChart = true }: { outlook: Outlook; compact?: boolean; showChart?: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(!compact);
  const text = { color: colors.foreground, fontSize: 14, lineHeight: 21 };
  const muted = { color: colors.mutedForeground, fontSize: 12, lineHeight: 19 };
  const { timed, assisted, calibration } = outlook;
  const bodyweight = outlook.exercise.equipment === "bodyweight";
  const value = (set: Outlook["sessions"][number]["targets"][number]) => timed ? set.durationSeconds ?? 0 : bodyweight ? set.reps : set.weightKg;
  return <View style={{ gap: 12 }}>
    <Text style={text}>{outlook.scheduleSource}</Text>
    <Text style={muted}>{timed ? "Удержание в секундах" : `${outlook.repsMin}–${outlook.repsMax} повт. · целевой запас ${outlook.targetRir}`}{outlook.exercise.equipment === "dumbbell" ? " · вес одной гантели" : assisted ? " · противовес" : bodyweight ? " · вес указан дополнительный" : ""}</Text>
    {calibration ? <Text style={{ ...muted, color: colors.amber }}>Нужен подборочный подход. Остальные подходы и дальнейшая прибавка определятся после оценки запаса и техники.</Text> : null}
    {outlook.changeKg != null && outlook.changeKg !== 0 ? <Text style={{ ...text, color: outlook.changeKg > 0 ? colors.success : colors.mutedForeground }}>Возможное изменение веса в сценарии: {outlook.changeKg > 0 ? "+" : ""}{formatKg(outlook.changeKg)}</Text> : null}
    {outlook.progression ? <View style={{ gap: 6 }}>
      <Text style={text}>Следующий шаг: {formatKg(outlook.progression.nextWeightKg)}{outlook.progression.earliestDate ? ` · около ${formatDate(`${outlook.progression.earliestDate}T12:00:00`)}` : ""}</Text>
      <Text style={muted}>Сначала {outlook.progression.confirmations} полных занятия по {outlook.progression.reps} повт. во всех назначенных подходах, с запасом не меньше {outlook.progression.targetRir} и сохранённой техникой. До этого вес может оставаться прежним, пока растут повторы. Дата условная.</Text>
    </View> : null}
    {showChart && !calibration && outlook.sessions.length > 1 ? <LineChart points={outlook.sessions.map(row => ({ date: `${row.date}T12:00:00`, value: value(row.targets[0]) }))} height={130} color={colors.success} forecastStartIndex={0} zeroBaseline={false} label="Условный прогноз нагрузки" minimumSpan={timed ? 5 : bodyweight ? 1 : (outlook.weightStepKg ?? 2.5) * 2} formatPoint={index => timed ? `${outlook.sessions[index].targets[0].durationSeconds} с` : `${formatKg(outlook.sessions[index].targets[0].weightKg)} × ${outlook.sessions[index].targets[0].reps}`} formatValue={timed ? n => `${formatNumber(n)} с` : bodyweight ? n => `${formatNumber(n)} повт.` : formatKg} /> : null}
    {outlook.sessions.map((session, index) => compact && !expanded && session.targets.every(set => set.weightKg === session.targets[0].weightKg && set.reps === session.targets[0].reps && set.durationSeconds === session.targets[0].durationSeconds) ? <View key={`${session.date}-${index}`} style={{ gap: 5, borderTopWidth: 1, borderColor: colors.cardBorder, paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
        <Text style={text}>Около {formatShortDate(`${session.date}T12:00:00`)}</Text>
        <Text style={{ ...text, fontFamily: "Inter_600SemiBold", color: colors.success }}>{timed ? `${session.targets.length} × ${session.targets[0].durationSeconds} с` : `${session.targets.length} × ${session.targets[0].reps} · ${assisted ? "противовес " : bodyweight ? "+" : ""}${formatKg(session.targets[0].weightKg)}`}</Text>
      </View>
      <Text style={muted}>{session.calibration ? "Подбор нагрузки" : index ? "При успешном выполнении предыдущих" : "Ближайший ориентир"}</Text>
    </View> : <View key={`${session.date}-${index}`} style={{ gap: 6, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 10 }}>
      <Text style={{ ...text, fontFamily: "Inter_600SemiBold" }}>Около {formatDate(`${session.date}T12:00:00`)}</Text>
      <Text style={muted}>{session.targets.length} подх.{session.calibration ? " · подбор нагрузки" : index ? " · при успешном выполнении предыдущих" : " · ближайший ориентир"}</Text>
      {!timed && session.targets.every(set => set.weightKg === session.targets[0].weightKg && set.reps === session.targets[0].reps) ? <Text style={{ ...text, fontFamily: "Inter_600SemiBold" }}>{session.targets.length} × {session.targets[0].reps} · {assisted ? "противовес " : bodyweight ? "+" : ""}{formatKg(session.targets[0].weightKg)}</Text> : null}
      {session.targets.map((set, setIndex) => <View key={setIndex} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", minHeight: 28 }}>
        <Text style={muted}>Подход {setIndex + 1}</Text>
        <Text style={text}>{timed ? `${set.durationSeconds} с` : `${assisted ? "Противовес " : bodyweight ? "+" : ""}${formatKg(set.weightKg)} × ${set.reps}`}</Text>
      </View>)}
    </View>)}
    {compact && outlook.sessions.length ? <Pressable accessibilityRole="button" accessibilityLabel="Подходы следующих занятий" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ ...muted, color: colors.accent, flex: 1 }}>{expanded ? "Свернуть подходы" : "По подходам"}</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable> : null}
    <Text style={muted}>{outlook.reason}</Text>
    <Text style={muted}>{outlook.assumptions}</Text>
  </View>;
}
