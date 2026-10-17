import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { formatSetResult, type MeasuredSet } from "@/lib/workoutMeasurement";

export function PreviousExerciseSets({ exerciseId }: { exerciseId: number }) {
  const colors = useColors();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const previous = useQuery({ queryKey: ["previous-workout", exerciseId], queryFn: () => coachRequest<{ workoutId: number | null; workoutDate: string | null; sets: MeasuredSet[] }>(`/api/exercises/${exerciseId}/last-sets`) });
  const data = previous.data;
  return <View style={{ gap: 8, paddingVertical: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Feather name="rotate-ccw" size={14} color={colors.accent} />
      <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>Прошлая тренировка{data?.workoutDate ? ` · ${new Date(data.workoutDate).toLocaleDateString("ru-RU")}` : ""}</Text>
      {data?.workoutId ? <Pressable accessibilityRole="button" accessibilityLabel="Открыть прошлую тренировку" onPress={() => router.push(`/history/${data.workoutId}`)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="arrow-up-right" size={18} color={colors.accent} /></Pressable> : null}
    </View>
    {previous.isError ? <Pressable accessibilityRole="button" onPress={() => { void previous.refetch(); }}><Text style={{ color: colors.amber, fontSize: 12 }}>Не удалось загрузить · повторить</Text></Pressable> : previous.isPending || !data?.sets.length ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{previous.isPending ? "Загрузка..." : "Нет завершённых подходов"}</Text> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {(expanded ? data.sets : data.sets.slice(0, 3)).map((set, index) => <View key={set.id} style={{ minWidth: 74, maxWidth: "100%", flexShrink: 1, borderLeftWidth: 2, borderColor: colors.cardBorder, paddingLeft: 8, gap: 3 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 20 }}>{formatSetResult(set)}</Text>
      </View>)}
    </View>}
    {(data?.sets.length ?? 0) > 3 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6 }}><Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{expanded ? "Свернуть" : `Все подходы (${data!.sets.length})`}</Text></Pressable> : null}
  </View>;
}
