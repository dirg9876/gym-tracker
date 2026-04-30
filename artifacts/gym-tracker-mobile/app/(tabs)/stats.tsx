import { Feather } from "@expo/vector-icons";
import { useGetProgress, useGetStatsOverview } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BarChart } from "@/components/BarChart";
import { Card } from "@/components/Card";
import { HeatmapCalendar } from "@/components/HeatmapCalendar";
import { LineChart } from "@/components/LineChart";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: stats, isLoading: l1 } = useGetStatsOverview();
  const { data: progress, isLoading: l2 } = useGetProgress();

  if (l1 || l2) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!stats || !progress) {
    return (
      <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground }}>Нет данных</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 22,
      }}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>Статистика</Text>

      <Card padding={16}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Feather name="trending-up" size={14} color={colors.primary} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Максимальный тоннаж
          </Text>
        </View>
        <Text style={{ color: colors.primary, fontSize: 28, fontFamily: "Inter_700Bold" }}>
          {formatKg(stats.bestTonnage)}
        </Text>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          { label: "Рекорд повторов", value: formatNumber(stats.bestReps) },
          { label: "Макс. вес", value: formatKg(stats.bestMaxWeight) },
          { label: "Всего трен.", value: String(stats.totalWorkouts) },
          { label: "Серия (дней)", value: String(stats.currentStreakDays) },
        ].map((s) => (
          <Card key={s.label} style={{ width: "48%" }} padding={14}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{s.label}</Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 18,
                fontFamily: "Inter_700Bold",
                marginTop: 4,
              }}
            >
              {s.value}
            </Text>
          </Card>
        ))}
      </View>

      <HeatmapCalendar />

      {progress.points.length > 0 ? (
        <View style={{ gap: 14 }}>
          <Card padding={16}>
            <Text style={[styles.section, { color: colors.foreground }]}>Тоннаж</Text>
            <LineChart
              points={progress.points.map((p) => ({ date: p.date, value: p.volume }))}
              color={colors.chart1}
              formatValue={formatKg}
            />
          </Card>
          <Card padding={16}>
            <Text style={[styles.section, { color: colors.foreground }]}>Повторения</Text>
            <LineChart
              points={progress.points.map((p) => ({ date: p.date, value: p.reps }))}
              color={colors.chart2}
              formatValue={formatNumber}
            />
          </Card>
        </View>
      ) : null}

      {stats.muscleGroupVolume.length > 0 ? (
        <Card padding={16}>
          <Text style={[styles.section, { color: colors.foreground }]}>Объем по мышцам</Text>
          <BarChart
            bars={stats.muscleGroupVolume.map((m) => ({
              label: m.muscleGroup,
              value: m.volume,
            }))}
          />
        </Card>
      ) : null}

      {stats.topExercises.length > 0 ? (
        <View>
          <Text
            style={[styles.section, { color: colors.foreground, marginBottom: 10, marginLeft: 4 }]}
          >
            Топ упражнений
          </Text>
          <Card padding={0}>
            {stats.topExercises.map((ex, i) => (
              <Pressable
                key={ex.exerciseId}
                onPress={() => router.push(`/exercises/${ex.exerciseId}`)}
                style={({ pressed }) => ({
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.cardBorder,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 18,
                    fontFamily: "Inter_700Bold",
                    width: 24,
                  }}
                >
                  {i + 1}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                    {ex.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {ex.muscleGroup}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.primary, fontSize: 14, fontFamily: "Inter_700Bold" }}>
                    {formatKg(ex.volume)}
                  </Text>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 10,
                      fontFamily: "Inter_500Medium",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {ex.sets} подх.
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 8 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  section: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 14 },
});
