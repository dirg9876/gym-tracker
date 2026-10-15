import { getListWorkoutsQueryKey, useListWorkouts } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";
import { durationOf, formatSeconds } from "@/lib/workoutMeasurement";

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const [limit, setLimit] = useState(50);
  const { data: workouts, isLoading, isFetching, isError, error, refetch } = useListWorkouts({ limit }, { query: { queryKey: getListWorkoutsQueryKey({ limit }), placeholderData: previous => previous } });

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

  if (isError) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, gap: 16 }}>
    <Text style={{ color: colors.foreground, fontSize: 16 }}>Не удалось загрузить историю</Text>
    <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{error instanceof Error ? error.message : "Повторите попытку."}</Text>
    <Button title="Повторить загрузку" variant="secondary" onPress={() => { void refetch(); }} loading={isFetching} />
    <Button title="Резервная копия" variant="ghost" onPress={() => router.push("/backup")} />
  </View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        gap: 18,
      }}
    >
      {!workouts || workouts.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 24 }}>
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
            Первая тренировка ещё впереди
          </Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {workouts.map((w) => (
            <Card key={w.id} onPress={() => router.push(w.finishedAt ? `/history/${w.id}` : `/workout/${w.id}`)} padding={16}>
              {!w.finishedAt ? <Text style={{ color: colors.amber, fontSize: 12, marginBottom: 8 }}>В процессе</Text> : null}
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
                <DeleteWorkoutButton workoutId={w.id} name={w.name || "Тренировка"} />
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  durationOf(w) > 0 && w.totalVolume === 0
                    ? { label: "Удержания", value: formatSeconds(durationOf(w)) }
                    : { label: "Тоннаж", value: formatKg(w.totalVolume) },
                  { label: "Повторы", value: formatNumber(w.totalReps) },
                  { label: "Подходы", value: String(w.totalSets) },
                ].map((s) => (
                  <View
                    key={s.label}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={[styles.statLabel, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit>
                      {s.label}
                    </Text>
                    <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
                      {s.value}
                    </Text>
                  </View>
                ))}
              </View>

              {durationOf(w) > 0 && w.totalVolume > 0 ? <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 8 }}>Удержания: {formatSeconds(durationOf(w))}</Text> : null}
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
          {workouts.length >= limit ? <Button title="Более ранние тренировки" variant="secondary" loading={isFetching} onPress={() => setLimit(value => value + 50)} /> : null}
        </View>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
