import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { WorkoutSet } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { formatSetResult, formatSetContext } from "@/lib/workoutMeasurement";

type Props = {
  set: WorkoutSet;
  index: number;
  onDelete: () => void;
  disabled?: boolean;
};

export function SetCard({ set, index, onDelete, disabled = false }: Props) {
  const colors = useColors();
  const deletion = useRef({ disabled, onDelete });
  useEffect(() => { deletion.current = { disabled, onDelete }; }, [disabled, onDelete]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.successBorder },
      ]}
    >
      <View style={[styles.indexBadge, { backgroundColor: colors.successSoft }]}>
        <Feather name="check" size={12} color={colors.success} />
        <Text style={[styles.indexText, { color: colors.success }]}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.value, { color: colors.success }]}>
          {formatSetResult(set)}
        </Text>
        {formatSetContext(set) ? <Text style={[styles.volume, { color: colors.mutedForeground }]}>
          {formatSetContext(set)}
        </Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Удалить подход ${index}: ${set.exerciseName}, ${formatSetResult(set)}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          if (disabled) return;
          Alert.alert("Удалить подход?", `${set.exerciseName}\nПодход ${index}: ${formatSetResult(set)}`, [
            { text: "Отмена", style: "cancel" },
            { text: "Удалить", style: "destructive", onPress: () => {
              if (deletion.current.disabled) return;
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              }
              deletion.current.onDelete();
            } },
          ]);
        }}
        hitSlop={10}
        style={({ pressed }) => [
          styles.deleteBtn,
          {
            backgroundColor: pressed ? colors.destructiveSoft : "transparent",
            opacity: disabled ? 0.35 : 1,
          },
        ]}
      >
        <Feather name="trash-2" size={16} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  indexBadge: {
    width: 32,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  value: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  volume: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
