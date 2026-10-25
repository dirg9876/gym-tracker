import {
  getGetWorkoutQueryKey,
  type WorkoutSet,
  useGetWorkout,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { AiCoachPanel } from "@/components/AiCoachPanel";
import { WorkoutAnalysis } from "@/components/WorkoutAnalysis";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SaveWorkoutTemplate } from "@/components/SaveWorkoutTemplate";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { SetEditor } from "@/components/SetEditor";
import type { EditableSet } from "@/lib/setEditing";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";
import { durationOf, formatSeconds, formatSetResult, formatSetContext, isTimedExercise } from "@/lib/workoutMeasurement";

export default function HistoryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);
  const [editingSet, setEditingSet] = useState<EditableSet | null>(null);

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
        right={<DeleteWorkoutButton workoutId={id} name={workout.name || "Тренировка"} disabled={!!editingSet} onDeleted={() => router.replace("/history")} />}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
      >
        <SaveWorkoutTemplate workout={workout} />
        <WorkoutAnalysis workoutId={workout.id} />
        <AiCoachPanel task="review" workoutId={workout.id} />
        <AiCoachPanel task="next_workout" workoutId={workout.id} />
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

        {durationOf(workout) > 0 ? <Text style={{ color: colors.foreground, fontSize: 16 }}>Удержания: {formatSeconds(durationOf(workout))}</Text> : null}
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
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                    {group.name}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                    {isTimedExercise(group.name) ? formatSeconds(group.sets.reduce((sum, set) => sum + durationOf(set), 0)) : formatKg(exVolume)}
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
                      <View style={{ flex: 1, gap: 4, alignItems: "flex-end" }}><Text
                        style={{
                          color: colors.foreground,
                          fontSize: 14,
                          fontFamily: "Inter_700Bold",
                        }}
                      >
                        {formatSetResult(set)}
                      </Text>
                      {formatSetContext(set) ? <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "right" }}>{formatSetContext(set)}</Text> : null}</View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Изменить подход ${idx + 1}: ${set.exerciseName}`} onPress={() => setEditingSet(set as EditableSet)} style={{ width: 44, height: 44, marginLeft: 8, alignItems: "center", justifyContent: "center" }}><Feather name="edit-3" size={18} color={colors.accent} /></Pressable>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
      {editingSet ? <SetEditor key={editingSet.id} set={editingSet} onClose={() => setEditingSet(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  value: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
});
