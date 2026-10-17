import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { WorkoutSet } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { formatSetResult, formatSetContext } from "@/lib/workoutMeasurement";

type Props = {
  set: WorkoutSet;
  index: number;
  onDelete: () => void;
};

export function SetCard({ set, index, onDelete }: Props) {
  const colors = useColors();

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
        accessibilityLabel={`Удалить подход ${index}: ${formatSetResult(set)}`}
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
          onDelete();
        }}
        hitSlop={10}
        style={({ pressed }) => [
          styles.deleteBtn,
          {
            backgroundColor: pressed ? colors.destructiveSoft : "transparent",
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
