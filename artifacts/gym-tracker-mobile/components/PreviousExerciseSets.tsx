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
  return <View style={{ gap: 5 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>Прошлая тренировка{data?.workoutDate ? ` · ${new Date(data.workoutDate).toLocaleDateString("ru-RU")}` : ""}</Text>
      {data?.workoutId ? <Pressable accessibilityRole="button" accessibilityLabel="Открыть прошлую тренировку" onPress={() => router.push(`/history/${data.workoutId}`)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Feather name="arrow-up-right" size={18} color={colors.mutedForeground} /></Pressable> : null}
    </View>
    {previous.isError ? <Pressable accessibilityRole="button" onPress={() => { void previous.refetch(); }}><Text style={{ color: colors.amber, fontSize: 12 }}>Не удалось загрузить · повторить</Text></Pressable> : <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}>{previous.isPending ? "Загрузка..." : !data?.sets.length ? "Нет завершённых подходов" : (expanded ? data.sets : data.sets.slice(0, 3)).map(formatSetResult).join(" · ")}</Text>}
    {(data?.sets.length ?? 0) > 3 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6 }}><Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{expanded ? "Свернуть" : `Все подходы (${data!.sets.length})`}</Text></Pressable> : null}
  </View>;
}
