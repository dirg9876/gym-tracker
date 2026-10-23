import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { ExerciseOutlook as Outlook } from "@/lib/exerciseOutlook";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";
import { LineChart } from "./LineChart";

export function ExerciseOutlook({ outlook, compact = false }: { outlook: Outlook; compact?: boolean }) {
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
    {outlook.changeKg != null ? <Text style={{ ...text, color: colors.success }}>Изменение веса к последнему показанному занятию: {outlook.changeKg > 0 ? "+" : ""}{formatKg(outlook.changeKg)} · условный сценарий</Text> : null}
    {!calibration && outlook.sessions.length > 1 ? <LineChart points={outlook.sessions.map(row => ({ date: `${row.date}T12:00:00`, value: value(row.targets[0]) }))} height={130} color={colors.success} zeroBaseline={false} label="Условный прогноз нагрузки" formatValue={timed ? n => `${formatNumber(n)} с` : bodyweight ? n => `${formatNumber(n)} повт.` : formatKg} /> : null}
    {(expanded ? outlook.sessions : outlook.sessions.slice(0, 1)).map((session, index) => <View key={`${session.date}-${index}`} style={{ gap: 6, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 10 }}>
      <Text style={{ ...text, fontFamily: "Inter_600SemiBold" }}>Около {formatDate(`${session.date}T12:00:00`)}</Text>
      <Text style={muted}>{session.targets.length} подх.{session.calibration ? " · подбор нагрузки" : index ? " · при успешном выполнении предыдущих" : " · ближайший ориентир"}</Text>
      {session.targets.map((set, setIndex) => <View key={setIndex} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", minHeight: 28 }}>
        <Text style={muted}>Подход {setIndex + 1}</Text>
        <Text style={text}>{timed ? `${set.durationSeconds} с` : `${assisted ? "Противовес " : bodyweight ? "+" : ""}${formatKg(set.weightKg)} × ${set.reps}`}</Text>
      </View>)}
    </View>)}
    {compact && outlook.sessions.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Следующие занятия упражнения" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ ...muted, color: colors.accent, flex: 1 }}>{expanded ? "Свернуть следующие занятия" : `Ещё занятий: ${outlook.sessions.length - 1}`}</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable> : null}
    <Text style={muted}>{outlook.reason}</Text>
    <Text style={muted}>{outlook.assumptions}</Text>
  </View>;
}
