import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { WorkoutSet } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

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
        { backgroundColor: colors.muted, borderColor: colors.cardBorder },
      ]}
    >
      <View style={[styles.indexBadge, { backgroundColor: colors.card }]}>
        <Text style={[styles.indexText, { color: colors.mutedForeground }]}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.value, { color: colors.foreground }]}>
          {formatKg(set.weightKg)}{" "}
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>×</Text> {set.reps}
        </Text>
        <Text style={[styles.volume, { color: colors.mutedForeground }]}>
          {formatKg(set.volume)} объёма
        </Text>
      </View>
      <Pressable
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  indexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  value: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  volume: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
