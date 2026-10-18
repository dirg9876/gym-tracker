import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatShortDate } from "@/lib/format";
import type { TrainingInsights } from "@/lib/trainingInsights";

const dateOf = (key: string) => `${key}T12:00:00`;
export function TrainingCalendar({ days }: { days: TrainingInsights["calendar"] }) {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!days.length) return null;
  const selected = days.find(day => day.date === selectedDate) ?? days.at(-1)!;
  const leading = (new Date(dateOf(days[0].date)).getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((days.length + leading) / 7) * 7 }, (_, index) => days[index - leading] ?? null);
  const rows = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatShortDate(dateOf(days[0].date))} - {formatShortDate(dateOf(days.at(-1)!.date))}</Text>
    <View style={{ flexDirection: "row", gap: 4 }}>{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <Text key={day} style={{ flex: 1, textAlign: "center", color: colors.mutedForeground, fontSize: 11 }}>{day}</Text>)}</View>
    {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 4 }}>
      {row.map((day, column) => day ? <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={`${formatDate(dateOf(day.date))}: тренировок ${day.workouts}, подходов ${day.sets}`} accessibilityState={{ selected: day.date === selected.date }} onPress={() => setSelectedDate(day.date)}
        style={{ flex: 1, minHeight: 34, paddingVertical: 5, justifyContent: "center", alignItems: "center", borderRadius: 4, borderWidth: 1,
          borderColor: day.date === selected.date ? colors.primary : "transparent", backgroundColor: day.workouts > 1 ? colors.accent : day.workouts ? colors.accentSoft : colors.muted }}>
        <Text style={{ color: day.workouts > 1 ? colors.accentForeground : day.workouts ? colors.accent : colors.mutedForeground, fontSize: 12, fontFamily: day.workouts ? "Inter_700Bold" : undefined }}>{Number(day.date.slice(-2))}</Text>
      </Pressable> : <View key={`empty-${column}`} style={{ flex: 1, minHeight: 34 }} />)}
    </View>)}
    <View style={{ minHeight: 44, justifyContent: "center", gap: 4 }}>
      <Text style={{ color: colors.foreground, fontSize: 13 }}>{formatDate(dateOf(selected.date))}</Text>
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Тренировок: {selected.workouts} · подходов: {selected.sets}</Text>
    </View>
  </View>;
}
