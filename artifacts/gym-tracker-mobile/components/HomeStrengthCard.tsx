import { Feather } from "@expo/vector-icons";
import {
  getGetExerciseProgressQueryKey,
  useGetExerciseProgress,
  useGetStatsOverview,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { LineChart } from "@/components/LineChart";
import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

export function HomeStrengthCard() {
  const colors = useColors();
  const router = useRouter();
  const { data: stats } = useGetStatsOverview();
  const top = stats?.topExercises[0];
  const topId = top?.exerciseId;

  const { data: progress } = useGetExerciseProgress(topId ?? 0, {
    query: {
      enabled: !!topId,
      queryKey: getGetExerciseProgressQueryKey(topId ?? 0),
    },
  });

  if (!top || !progress || progress.points.length < 2) return null;

  const currentMax = progress.points.reduce((max, point) => Math.max(max, point.maxWeight), 0);
  const firstMax = progress.points[0]!.maxWeight;
  const delta = currentMax - firstMax;

  return (
    <Card onPress={() => router.push(`/exercises/${top.exerciseId}`)} padding={16}>
      <View style={{ gap: 12 }}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.labelRow}>
              <Feather name="trending-up" size={13} color={colors.primary} />
              <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
                Прогресс силы · {top.muscleGroup}
              </Text>
            </View>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
              {top.name}
            </Text>
          </View>
          <View style={{ maxWidth: 120, alignItems: "flex-end" }}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={[styles.max, { color: colors.primary }]}
            >
              {formatKg(currentMax)}
            </Text>
            {delta !== 0 ? (
              <Text
                numberOfLines={2}
                style={[styles.delta, { color: delta > 0 ? "#34d399" : colors.destructive }]}
              >
                {delta > 0 ? "+" : ""}
                {formatKg(delta)} от старта
              </Text>
            ) : null}
          </View>
        </View>

        <LineChart
          points={progress.points.map((point) => ({ date: point.date, value: point.maxWeight }))}
          color={colors.primary}
          formatValue={formatKg}
          height={138}
        />

        <View style={styles.moreRow}>
          <Text style={[styles.more, { color: colors.primary }]}>Подробнее</Text>
          <Feather name="chevron-right" size={13} color={colors.primary} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { flex: 1, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6, textTransform: "uppercase" },
  name: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 20, marginTop: 3 },
  max: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "right" },
  delta: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "right", lineHeight: 15 },
  moreRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  more: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
