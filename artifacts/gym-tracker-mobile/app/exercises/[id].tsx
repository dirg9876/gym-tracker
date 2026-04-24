import { Feather } from "@expo/vector-icons";
import {
  getGetExerciseProgressQueryKey,
  useGetExerciseProgress,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { LineChart } from "@/components/LineChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";

export default function ExerciseProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: progress, isLoading } = useGetExerciseProgress(id, {
    query: { enabled: !!id, queryKey: getGetExerciseProgressQueryKey(id) },
  });

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

  if (!progress) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Не найдено" />
      </View>
    );
  }

  const { exercise, points } = progress;
  const maxWeight = points.length > 0 ? Math.max(...points.map((p) => p.maxWeight)) : 0;
  const maxVolume = points.length > 0 ? Math.max(...points.map((p) => p.volume)) : 0;
  const maxReps = points.length > 0 ? Math.max(...points.map((p) => p.reps)) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={exercise.name} subtitle={exercise.muscleGroup} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          gap: 18,
        }}
      >
        {/* Records */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { l: "Макс. вес", v: formatKg(maxWeight), accent: true },
            { l: "Объем", v: formatKg(maxVolume), accent: false },
            { l: "Повторы", v: formatNumber(maxReps), accent: false },
          ].map((s) => (
            <Card key={s.l} style={{ flex: 1 }} padding={12}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 9,
                  fontFamily: "Inter_700Bold",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {s.l}
              </Text>
              <Text
                style={{
                  color: s.accent ? colors.primary : colors.foreground,
                  fontSize: 16,
                  fontFamily: "Inter_700Bold",
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                {s.v}
              </Text>
            </Card>
          ))}
        </View>

        {points.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ color: colors.mutedForeground }}>Нет данных о тренировках</Text>
          </View>
        ) : (
          <>
            <Card padding={16}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Feather name="trending-up" size={16} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>
                  Максимальный вес
                </Text>
              </View>
              <LineChart
                points={points.map((p) => ({ date: p.date, value: p.maxWeight }))}
                color={colors.chart1}
                formatValue={formatKg}
              />
            </Card>

            <Card padding={16}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 }}>
                Объем за тренировку
              </Text>
              <LineChart
                points={points.map((p) => ({ date: p.date, value: p.volume }))}
                color={colors.chart2}
                formatValue={formatKg}
              />
            </Card>

            <View style={{ gap: 10 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontFamily: "Inter_700Bold",
                  paddingHorizontal: 4,
                }}
              >
                Лучшие подходы
              </Text>
              <Card padding={0}>
                {[...points].reverse().map((p, i) => (
                  <Pressable
                    key={p.workoutId}
                    onPress={() => router.push(`/history/${p.workoutId}`)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.cardBorder,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {new Date(p.date).toLocaleDateString("ru-RU")}
                    </Text>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontFamily: "Inter_700Bold",
                      }}
                    >
                      {formatKg(p.topSet.weightKg)}{" "}
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 13,
                          fontFamily: "Inter_400Regular",
                        }}
                      >
                        ×
                      </Text>{" "}
                      {p.topSet.reps}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
