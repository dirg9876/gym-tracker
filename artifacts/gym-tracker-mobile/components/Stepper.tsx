import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  chips?: number[];
  unit?: string;
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
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.row, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
        <Pressable
          onPress={() => tick(-step)}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="minus" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.valueWrap}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {Number.isInteger(value) ? value : value.toFixed(1)}
          </Text>
          {unit ? (
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => tick(step)}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="plus" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map((c) => {
            const active = c === value;
            return (
              <Pressable
                key={c}
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
                  {c}
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
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  btn: {
    width: 64,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  valueWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  value: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  unit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
