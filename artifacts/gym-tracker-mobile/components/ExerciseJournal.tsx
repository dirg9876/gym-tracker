import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/lib/format";
import type { InsightExercise } from "@/lib/trainingInsights";
import { formatSetContext, formatSetResult, sameLoadCategory } from "@/lib/workoutMeasurement";

export function ExerciseJournal({ item }: { item: InsightExercise }) {
  const colors = useColors(), router = useRouter(), [page, setPage] = useState(0);
  const historyPage = Math.min(page, Math.max(0, Math.ceil(item.history.length / 5) - 1));
  return <View style={{ gap: 12 }}>
    {item.unknownTimeSets ? <Text style={{ color: colors.amber, fontSize: 12 }}>Старые подходы без времени: {item.unknownTimeSets}</Text> : null}
    {item.otherCategorySets ? <Text style={{ color: colors.amber, fontSize: 12 }}>Уточните режим нагрузки для {item.otherCategorySets} подх.: противовес и обычный вес измеряются по-разному.</Text> : null}
    <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>Все занятия · {item.history.length}</Text>
    {item.history.slice(historyPage * 5, historyPage * 5 + 5).map(session => <View key={session.workoutId} style={{ gap: 8, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Открыть тренировку ${formatDate(session.date)}`} onPress={() => router.push(`/history/${session.workoutId}`)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{formatDate(session.date)}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{session.sets.length} подх.{session.name ? ` · ${session.name}` : ""}</Text></View>
        <Feather name="arrow-up-right" size={18} color={colors.accent} />
      </Pressable>
      {session.sets.map((set, index) => <View key={set.id} style={{ gap: 3 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}><Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Подход {index + 1}</Text><Text style={{ color: colors.foreground, fontSize: 14 }}>{formatSetResult(set)}</Text></View>
        {formatSetContext(set) ? <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{formatSetContext(set)}</Text> : null}
        {!sameLoadCategory(set, item.exercise) ? <Text style={{ color: colors.amber, fontSize: 12 }}>Отличается режим противовеса · требуется уточнение</Text> : null}
      </View>)}
    </View>)}
    {item.history.length > 5 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Более новые занятия упражнения" disabled={historyPage === 0} onPress={() => setPage(historyPage - 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: historyPage === 0 ? 0.35 : 1 }}><Feather name="chevron-left" size={20} color={colors.accent} /></Pressable>
      <Text style={{ flex: 1, textAlign: "center", color: colors.mutedForeground, fontSize: 12 }}>{historyPage * 5 + 1}–{Math.min(item.history.length, historyPage * 5 + 5)} из {item.history.length}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Более ранние занятия упражнения" disabled={(historyPage + 1) * 5 >= item.history.length} onPress={() => setPage(historyPage + 1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: (historyPage + 1) * 5 >= item.history.length ? 0.35 : 1 }}><Feather name="chevron-right" size={20} color={colors.accent} /></Pressable>
    </View> : null}
  </View>;
}
