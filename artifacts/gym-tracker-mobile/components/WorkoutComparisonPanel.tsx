import { Feather } from "@expo/vector-icons";
import {
  getGetWorkoutComparisonQueryKey,
  useGetWorkoutComparison,
} from "@workspace/api-client-react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";

type Props = {
  workoutId: number;
};

function deltaSign(n: number): "up" | "down" | "flat" {
  if (n > 0.0001) return "up";
  if (n < -0.0001) return "down";
  return "flat";
}

function DeltaPill({
  delta,
  formatFn,
}: {
  delta: number;
  formatFn: (n: number) => string;
}) {
  const colors = useColors();
  const sign = deltaSign(delta);
  const color =
    sign === "up" ? "#34d399" : sign === "down" ? colors.destructive : colors.mutedForeground;
  const bg =
    sign === "up" ? "rgba(52,211,153,0.12)" : sign === "down" ? colors.destructiveSoft : colors.muted;
  const icon = sign === "up" ? "trending-up" : sign === "down" ? "trending-down" : "minus";
  const prefix = sign === "up" ? "+" : "";

  return (
    <View style={[styles.deltaPill, { backgroundColor: bg, borderColor: color + "66" }]}>
      <Feather name={icon} size={12} color={color} />
      <Text style={[styles.deltaText, { color }]}>
        {prefix}
        {formatFn(delta)}
      </Text>
    </View>
  );
}

export function WorkoutComparisonPanel({ workoutId }: Props) {
  const colors = useColors();
  const { data, isLoading } = useGetWorkoutComparison(workoutId, {
    query: {
      enabled: !!workoutId,
      queryKey: getGetWorkoutComparisonQueryKey(workoutId),
    },
  });

  if (isLoading || !data || data.previousWorkoutId === null) return null;

  const prevDate = data.previousWorkoutDate
    ? new Date(data.previousWorkoutDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.heading}>
        <View style={styles.headingLeft}>
          <Feather name="bar-chart-2" size={18} color={colors.primary} />
          <Text style={[styles.headingText, { color: colors.foreground }]}>Сравнение</Text>
        </View>
        <Text style={[styles.prevText, { color: colors.mutedForeground }]} numberOfLines={2}>
          с {prevDate ?? "пред. трен."}
          {data.previousWorkoutName ? ` · ${data.previousWorkoutName}` : ""}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Card style={{ flex: 1 }} padding={10}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Тоннаж</Text>
          <DeltaPill delta={data.deltaVolume} formatFn={formatKg} />
        </Card>
        <Card style={{ flex: 1 }} padding={10}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Повторы</Text>
          <DeltaPill delta={data.deltaReps} formatFn={formatNumber} />
        </Card>
        <Card style={{ flex: 1 }} padding={10}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Подходы</Text>
          <DeltaPill delta={data.deltaSets} formatFn={(n) => `${n}`} />
        </Card>
      </View>

      {data.exercises.length > 0 ? (
        <Card padding={0}>
          {data.exercises.slice(0, 8).map((ex, index) => (
            <View
              key={ex.exerciseId}
              style={[
                styles.exerciseRow,
                { borderTopColor: colors.cardBorder, borderTopWidth: index === 0 ? 0 : 1 },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={styles.exerciseTop}>
                  <Text
                    style={[styles.exerciseName, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {ex.name}
                  </Text>
                  <DeltaPill delta={ex.deltaVolume} formatFn={formatKg} />
                </View>
                <View style={styles.exerciseBottom}>
                  <Text
                    style={[styles.exerciseMeta, { color: colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    Макс: {formatKg(ex.currentMaxWeight)}
                    {ex.previousMaxWeight > 0 ? ` / было ${formatKg(ex.previousMaxWeight)}` : ""}
                  </Text>
                  {ex.deltaMaxWeight !== 0 ? (
                    <DeltaPill delta={ex.deltaMaxWeight} formatFn={formatKg} />
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, paddingHorizontal: 4 },
  headingLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headingText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  prevText: { flex: 1, textAlign: "right", fontSize: 12, fontFamily: "Inter_400Regular" },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  deltaPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  deltaText: { flexShrink: 1, fontSize: 11, fontFamily: "Inter_700Bold" },
  exerciseRow: { padding: 12 },
  exerciseTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  exerciseName: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 18 },
  exerciseBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  exerciseMeta: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
});
