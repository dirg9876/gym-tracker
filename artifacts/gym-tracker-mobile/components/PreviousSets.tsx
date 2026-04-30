import { Feather } from "@expo/vector-icons";
import {
  getGetExerciseLastSetsQueryKey,
  useGetExerciseLastSets,
} from "@workspace/api-client-react";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

type Props = {
  exerciseId: number;
  onRepeatLast?: (weightKg: number, reps: number) => void;
};

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function PreviousSets({ exerciseId, onRepeatLast }: Props) {
  const colors = useColors();
  const { data, isLoading } = useGetExerciseLastSets(exerciseId, {
    query: {
      enabled: !!exerciseId,
      queryKey: getGetExerciseLastSetsQueryKey(exerciseId),
    },
  });

  if (isLoading || !data || data.sets.length === 0) return null;

  const lastSet = data.sets[data.sets.length - 1]!;

  return (
    <Card padding={16} style={{ gap: 12 }}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Прошлая тренировка
          </Text>
        </View>
        {data.workoutDate ? (
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {formatRelativeDate(data.workoutDate)}
          </Text>
        ) : null}
      </View>

      <View style={styles.setsWrap}>
        {data.sets.map((set, index) => (
          <View
            key={`${set.weightKg}-${set.reps}-${index}`}
            style={[styles.setPill, { backgroundColor: colors.muted }]}
          >
            <Text style={[styles.setText, { color: colors.foreground }]}>
              {formatKg(set.weightKg)} <Text style={{ color: colors.mutedForeground }}>×</Text>{" "}
              {set.reps}
            </Text>
          </View>
        ))}
      </View>

      {data.bestEverWeightKg != null && data.bestEverReps != null ? (
        <View style={styles.bestRow}>
          <Feather name="award" size={14} color={colors.amber} />
          <Text style={[styles.bestText, { color: colors.amber }]}>
            Личный максимум: {formatKg(data.bestEverWeightKg)} × {data.bestEverReps}
          </Text>
        </View>
      ) : null}

      {onRepeatLast ? (
        <Pressable
          onPress={() => onRepeatLast(lastSet.weightKg, lastSet.reps)}
          style={({ pressed }) => [
            styles.repeat,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name="repeat" size={15} color={colors.primary} />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.74}
            numberOfLines={2}
            style={[styles.repeatText, { color: colors.primary }]}
          >
            Повторить: {formatKg(lastSet.weightKg)} × {lastSet.reps}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  label: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  date: { fontSize: 12, fontFamily: "Inter_500Medium" },
  setsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  setPill: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 },
  setText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bestRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bestText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  repeat: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  repeatText: { flexShrink: 1, textAlign: "center", fontSize: 14, fontFamily: "Inter_700Bold" },
});
