import { useListWorkouts } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: workouts, isLoading } = useListWorkouts({ limit: 50 });

  if (isLoading) {
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

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 18,
      }}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>История</Text>

      {!workouts || workouts.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
            Нет тренировок
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              marginTop: 6,
            }}
          >
            Начните свою первую тренировку на главной!
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {workouts.map((w) => (
            <Card key={w.id} onPress={() => router.push(`/history/${w.id}`)} padding={16}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <Text
                  style={[styles.title, { color: colors.foreground, flex: 1 }]}
                  numberOfLines={1}
                >
                  {w.name || "Тренировка"}
                </Text>
                <View
                  style={{
                    backgroundColor: colors.muted,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    {formatDate(w.startedAt)}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Тоннаж", value: formatKg(w.totalVolume) },
                  { label: "Повторы", value: formatNumber(w.totalReps) },
                  { label: "Подходы", value: String(w.totalSets) },
                ].map((s) => (
                  <View
                    key={s.label}
                    style={{
                      flex: 1,
                      backgroundColor: colors.background,
                      borderRadius: 10,
                      paddingVertical: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.statValue, { color: colors.foreground }]}>
                      {s.value}
                    </Text>
                  </View>
                ))}
              </View>

              {w.topExercises.length > 0 ? (
                <Text
                  style={{ color: colors.mutedForeground, fontSize: 12 }}
                  numberOfLines={1}
                >
                  {w.topExercises.join(" • ")}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 8 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  statValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
});
