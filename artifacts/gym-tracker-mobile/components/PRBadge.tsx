import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

const KIND_LABELS: Record<string, string> = {
  tonnage: "Тоннаж тренировки",
  reps: "Повторы за тренировку",
  max_weight: "Максимальный вес",
  max_volume_set: "Объём подхода",
  max_reps: "Повторов в подходе",
};

type Props = {
  kind: string;
  value: number;
  delta: number;
  formatFn: (n: number) => string;
  exerciseName?: string;
};

export function PRBadge({ kind, value, delta, formatFn, exerciseName }: Props) {
  const colors = useColors();
  const label = exerciseName ?? KIND_LABELS[kind] ?? "Рекорд";

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primary,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary }]}>
        <Feather name="award" size={18} color={colors.primaryForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
          {exerciseName ? KIND_LABELS[kind] ?? kind : "Личный рекорд"}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.primary }]}>
          {formatFn(value)}
          {delta > 0 ? (
            <Text style={[styles.delta, { color: colors.primary }]}> +{formatFn(delta)}</Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  delta: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
