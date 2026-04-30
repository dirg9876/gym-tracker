import {
  getGetLevelsQueryKey,
  getGetStatsOverviewQueryKey,
  getGetWorkoutExerciseBreakdownQueryKey,
  getGetWorkoutQueryKey,
  getListWorkoutsQueryKey,
  type WorkoutSet,
  useDeleteWorkout,
  useGetWorkout,
  useGetWorkoutExerciseBreakdown,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { ExerciseProgressCard } from "@/components/ExerciseProgressCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";

export default function HistoryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: workout, isLoading } = useGetWorkout(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutQueryKey(id) },
  });
  const { data: breakdown } = useGetWorkoutExerciseBreakdown(id, {
    query: {
      enabled: !!id,
      queryKey: getGetWorkoutExerciseBreakdownQueryKey(id),
    },
  });

  const deleteWorkout = useDeleteWorkout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        router.replace("/history");
      },
    },
  });

  const confirmDelete = () => {
    Alert.alert(
      "Удалить тренировку?",
      "Тренировка и все ее подходы будут удалены безвозвратно.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => deleteWorkout.mutate({ workoutId: id }),
        },
      ],
    );
  };

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
        right={
          <Pressable
            onPress={confirmDelete}
            disabled={deleteWorkout.isPending}
            hitSlop={10}
            style={({ pressed }) => [
              styles.deleteButton,
              {
                backgroundColor: colors.destructiveSoft,
                opacity: pressed || deleteWorkout.isPending ? 0.65 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </Pressable>
        }
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

        {breakdown && breakdown.items.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.section, { color: colors.foreground }]}>
              Сводка по упражнениям
            </Text>
            {breakdown.items.map((item) => (
              <ExerciseProgressCard key={item.exerciseId} item={item} />
            ))}
          </View>
        ) : null}

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
  section: { fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 4 },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
