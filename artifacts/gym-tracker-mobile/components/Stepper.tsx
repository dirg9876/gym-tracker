import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  chips?: number[];
  unit?: string;
  disabled?: boolean;
  compact?: boolean;
};

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  chips = [],
  unit,
  disabled = false,
  compact = false,
}: Props) {
  const colors = useColors();

  const tick = (delta: number) => {
    const next = Math.min(max, Math.max(min, +(value + delta).toFixed(2)));
    if (next !== value) {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }
      onChange(next);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }, compact && { minHeight: 32 }]}>{label}</Text>
      <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }, compact && { height: 68 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Уменьшить: ${label}`}
          accessibilityState={{ disabled: disabled || value <= min }}
          disabled={disabled || value <= min}
          onPress={() => tick(-step)}
          style={({ pressed }) => [
            styles.btn, compact && { width: 44 },
            { backgroundColor: pressed ? colors.secondary : "transparent", opacity: disabled || value <= min ? 0.35 : 1 },
          ]}
        >
          <Feather name="minus" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.valueWrap}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.value, { color: colors.foreground }, compact && { fontSize: 30 }]}
          >
            {formatNumber(value)}
          </Text>
          {unit ? (
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Увеличить: ${label}`}
          accessibilityState={{ disabled: disabled || value >= max }}
          disabled={disabled || value >= max}
          onPress={() => tick(step)}
          style={({ pressed }) => [
            styles.btn, compact && { width: 44 },
            { backgroundColor: pressed ? colors.secondary : "transparent", opacity: disabled || value >= max ? 0.35 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.filter(c => c >= min && c <= max).map((c) => {
            const active = c === value;
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${formatNumber(c)}${unit ? ` ${unit}` : ""}`}
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                hitSlop={4}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                  onChange(c);
                }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.muted,
                    borderColor: active ? colors.primary : colors.cardBorder,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {formatNumber(c)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  btn: {
    width: 52,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  value: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    minWidth: 44,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
