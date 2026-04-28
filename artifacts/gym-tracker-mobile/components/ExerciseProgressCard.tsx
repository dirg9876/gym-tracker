import { Feather } from "@expo/vector-icons";
import type { WorkoutExerciseBreakdownItem } from "@workspace/api-client-react";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";

type Props = {
  item: WorkoutExerciseBreakdownItem;
};

function DeltaTag({
  value,
  format,
  invertColors = false,
}: {
  value: number | null;
  format: (n: number) => string;
  invertColors?: boolean;
}) {
  const colors = useColors();
  if (value === null) {
    return <Text style={[styles.delta, { color: colors.mutedForeground }]}>— впервые</Text>;
  }
  if (value === 0) {
    return (
      <View style={styles.deltaRow}>
        <Feather name="minus" size={12} color={colors.mutedForeground} />
        <Text style={[styles.delta, { color: colors.mutedForeground }]}>0</Text>
      </View>
    );
  }
  const positive = invertColors ? value < 0 : value > 0;
  const color = positive ? "#34d399" : colors.destructive;
  const icon = value > 0 ? "arrow-up" : "arrow-down";
  const sign = value > 0 ? "+" : "";
  return (
    <View style={styles.deltaRow}>
      <Feather name={icon} size={12} color={color} />
      <Text style={[styles.delta, { color }]}>
        {sign}
        {format(Math.abs(value))}
      </Text>
    </View>
  );
}

export function ExerciseProgressCard({ item }: Props) {
  const colors = useColors();
  const hasPrev = item.previousSessionDate !== null;

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {item.exerciseName}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.muscleGroup} · {item.sets} подх.
          </Text>
        </View>
        {item.isPersonalRecord ? (
          <View style={[styles.pr, { backgroundColor: colors.primary }]}>
            <Feather name="award" size={12} color={colors.primaryForeground} />
            <Text style={[styles.prText, { color: colors.primaryForeground }]}>PR</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cells}>
        <Cell
          label="Тоннаж"
          value={formatKg(item.volume)}
          delta={<DeltaTag value={item.deltaVolume} format={formatKg} />}
        />
        <Cell
          label="Топ-сет"
          value={`${formatKg(item.topSetWeight)} × ${item.topSetReps}`}
          delta={<DeltaTag value={item.deltaTopWeight} format={formatKg} />}
        />
        <Cell
          label="Повторы"
          value={formatNumber(item.reps)}
          delta={<DeltaTag value={item.deltaReps} format={formatNumber} />}
        />
      </View>

      <View style={[styles.footer, { backgroundColor: colors.muted }]}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          {hasPrev
            ? `Сравнение с ${
                item.previousSessionWorkoutName
                  ? `«${item.previousSessionWorkoutName}»`
                  : "прошлой тренировкой"
              } от ${formatDate(item.previousSessionDate as string)}`
            : "Первое упражнение в истории. Сравнение появится после следующей тренировки."}
        </Text>
      </View>
    </Card>
  );
}

function Cell({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.68}
        numberOfLines={2}
        style={[styles.cellValue, { color: colors.foreground }]}
      >
        {value}
      </Text>
      {delta}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 1,
  },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", lineHeight: 19 },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  pr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  prText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  cells: { flexDirection: "row" },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 12,
    gap: 4,
  },
  cellLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  cellValue: { fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },
  deltaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  delta: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  footer: { paddingHorizontal: 14, paddingVertical: 10 },
  footerText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
