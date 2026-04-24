import {
  getGetWorkoutQueryKey,
  type WorkoutSet,
  useGetWorkout,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";

export default function HistoryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: workout, isLoading } = useGetWorkout(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutQueryKey(id) },
  });

  const setsByExercise = useMemo<
    { exerciseId: number; name: string; sets: WorkoutSet[] }[]
  >(() => {
    if (!workout) return [];
    const map = new Map<number, { name: string; sets: WorkoutSet[] }>();
    for (const s of workout.sets) {
      const cur = map.get(s.exerciseId);
      if (cur) cur.sets.push(s);
      else map.set(s.exerciseId, { name: s.exerciseName, sets: [s] });
    }
    return Array.from(map.entries()).map(([exerciseId, v]) => ({
      exerciseId,
      name: v.name,
      sets: v.sets,
    }));
  }, [workout]);

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

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Не найдено" onBack={() => router.replace("/history")} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={workout.name || "Тренировка"}
        subtitle={formatDate(workout.startedAt)}
        onBack={() => router.replace("/history")}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1 }} padding={14}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Тоннаж</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatKg(workout.totalVolume)}
            </Text>
          </Card>
          <Card style={{ flex: 1 }} padding={14}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Повторы</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatNumber(workout.totalReps)}
            </Text>
          </Card>
        </View>

        <View style={{ gap: 14 }}>
          {setsByExercise.map((group) => {
            const exVolume = group.sets.reduce((sum, s) => sum + s.volume, 0);
            return (
              <Card key={group.exerciseId} padding={0}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 14,
                    backgroundColor: colors.muted,
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                    {formatKg(exVolume)}
                  </Text>
                </View>
                <View style={{ paddingVertical: 6 }}>
                  {group.sets.map((set, idx) => (
                    <View
                      key={set.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 13,
                          width: 24,
                        }}
                      >
                        {idx + 1}
                      </Text>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontFamily: "Inter_700Bold",
                        }}
                      >
                        {formatKg(set.weightKg)}{" "}
                        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                          ×
                        </Text>{" "}
                        {set.reps}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
});
