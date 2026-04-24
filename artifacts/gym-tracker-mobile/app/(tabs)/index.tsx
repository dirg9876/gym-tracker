import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetActiveWorkoutQueryKey,
  useCreateWorkout,
  useGetActiveWorkout,
  useGetLevels,
  useGetStatsOverview,
  useListWorkouts,
} from "@workspace/api-client-react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatKg, formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/levelImages";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: activeWorkoutResponse, isLoading: isLoadingActive } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const { data: stats, isLoading: isLoadingStats } = useGetStatsOverview();
  const { data: recentWorkouts, isLoading: isLoadingWorkouts } = useListWorkouts({ limit: 3 });
  const { data: levelsData } = useGetLevels();

  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: (newWorkout) => {
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        router.push(`/workout/${newWorkout.id}`);
      },
    },
  });

  const handleStart = () => {
    if (activeWorkout) {
      router.push(`/workout/${activeWorkout.id}`);
    } else {
      createWorkout.mutate({ data: {} });
    }
  };

  const isLoading = isLoadingActive || isLoadingStats || isLoadingWorkouts;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const cur = levelsData ? levelsData.levels[levelsData.currentLevel] : null;
  const nxt = levelsData ? levelsData.levels[levelsData.currentLevel + 1] : null;
  const tonProg =
    nxt && nxt.tonnage30dKgRequired > 0 && levelsData
      ? Math.min(100, (levelsData.stats.currentTonnage30dKg / nxt.tonnage30dKgRequired) * 100)
      : 100;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 24,
      }}
    >
      {/* Hero */}
      <View style={{ marginTop: 8 }}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Готов к работе?</Text>
        <Button
          size="xl"
          fullWidth
          onPress={handleStart}
          loading={createWorkout.isPending}
          icon={
            <Feather
              name={activeWorkout ? "activity" : "zap"}
              size={22}
              color={colors.primaryForeground}
            />
          }
          title={activeWorkout ? "Продолжить тренировку" : "Начать тренировку"}
          style={{ marginTop: 18, height: 76 }}
        />
      </View>

      {/* Level card */}
      {cur && levelsData ? (
        <Card onPress={() => router.push("/levels")} padding={14}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Image
              source={levelImage(cur.level, cur.tier)}
              style={{ width: 56, height: 56 }}
              contentFit="contain"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={[styles.lvlBadge, { color: colors.primary }]}>LVL {cur.level}</Text>
                <Text style={[styles.lvlName, { color: colors.foreground }]} numberOfLines={1}>
                  {cur.name}
                </Text>
              </View>
              {nxt ? (
                <>
                  <Text
                    style={[styles.lvlMeta, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    До «{nxt.name}»: {formatNumber(levelsData.stats.currentTonnage30dKg)} /{" "}
                    {formatNumber(nxt.tonnage30dKgRequired)} кг
                  </Text>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: colors.muted,
                      borderRadius: 3,
                      marginTop: 6,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${tonProg}%`,
                        backgroundColor: colors.primary,
                      }}
                    />
                  </View>
                </>
              ) : (
                <Text
                  style={[styles.lvlMeta, { color: colors.mutedForeground, marginTop: 2 }]}
                >
                  Максимальный уровень
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
        </Card>
      ) : null}

      {/* Stats */}
      {stats ? (
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Card style={{ flex: 1 }} padding={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Feather name="zap" size={14} color={colors.amber} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Серия</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {stats.currentStreakDays}{" "}
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>дн.</Text>
            </Text>
          </Card>
          <Card style={{ flex: 1 }} padding={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Feather name="activity" size={14} color={colors.primary} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Тоннаж</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatKg(stats.totalVolume)}
            </Text>
          </Card>
        </View>
      ) : null}

      {/* Recent workouts */}
      {recentWorkouts && recentWorkouts.length > 0 ? (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[styles.h2, { color: colors.foreground }]}>Последние тренировки</Text>
            <Pressable onPress={() => router.push("/history")} hitSlop={10}>
              <Text style={[styles.linkAll, { color: colors.primary }]}>Все</Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {recentWorkouts.map((w) => (
              <Card key={w.id} onPress={() => router.push(`/history/${w.id}`)}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={[styles.wkTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {w.name || "Тренировка"}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {formatDate(w.startedAt)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Stat label="Объем" value={formatKg(w.totalVolume)} colors={colors} />
                  <Stat
                    label="Повторы"
                    value={formatNumber(w.totalReps)}
                    colors={colors}
                  />
                  <Stat label="Упражнения" value={String(w.exerciseCount)} colors={colors} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 10,
          fontFamily: "Inter_700Bold",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  h2: { fontSize: 17, fontFamily: "Inter_700Bold" },
  lvlBadge: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  lvlName: { fontSize: 14, fontFamily: "Inter_700Bold", flexShrink: 1 },
  lvlMeta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 4 },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  wkTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1, marginRight: 8 },
  linkAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
