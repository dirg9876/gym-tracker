import Feather from "@expo/vector-icons/Feather";
import {
  getGetExerciseProgressQueryKey,
  useGetExerciseProgress,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { LineChart } from "@/components/LineChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StandardsPanel } from "@/components/StandardsPanel";
import type { RankedExercise } from "@/lib/exerciseStandards";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";
import { durationOf, maxDurationOf, formatSeconds, isTimedExercise } from "@/lib/workoutMeasurement";
import { isAssisted } from "@/lib/equipmentSettings";


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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
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
  const ranked = exercise as RankedExercise;
  const timed = isTimedExercise(exercise.name);
  const repBased = ranked.standard?.unit === "reps";
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
          {(timed ? [
            { l: "Рекорд удержания", v: formatSeconds(Math.max(0, ...points.map(maxDurationOf))), accent: true },
            { l: "Всего времени", v: formatSeconds(points.reduce((sum, point) => sum + durationOf(point), 0)), accent: false },
          ] : repBased ? [
            { l: "Лучший подход", v: `${ranked.rankBest ?? 0} повт.`, accent: true },
            { l: "Всего повторов", v: formatNumber(points.reduce((sum, point) => sum + point.reps, 0)), accent: false },
          ] : [
            { l: isAssisted(exercise) ? "Расчётная нагрузка" : "Макс. вес", v: formatKg(maxWeight), accent: true },
            { l: "Объем", v: formatKg(maxVolume), accent: false },
            { l: "Повторы", v: formatNumber(maxReps), accent: false },
          ]).map((s) => (
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

        {/* Rank ladder */}
        {ranked.standard && (
          <Card padding={16}>
            <StandardsPanel standard={ranked.standard} best={ranked.rankBest ?? 0} />
          </Card>
        )}

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
                  {timed ? "Лучшее удержание" : repBased ? "Повторы за лучший подход" : isAssisted(exercise) ? "Масса тела минус противовес" : "Максимальный вес"}
                </Text>
              </View>
              <LineChart
                points={points.map((p) => ({ date: p.date, value: timed ? maxDurationOf(p) : repBased ? p.topSet.reps : p.maxWeight }))}
                color={colors.chart1}
                formatValue={timed ? formatSeconds : repBased ? value => `${formatNumber(value)} повт.` : formatKg}
              />
            </Card>

            <Card padding={16}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 }}>
                {timed ? "Время удержаний за тренировку" : repBased ? "Повторы за тренировку" : "Тоннаж за тренировку"}
              </Text>
              <LineChart
                points={points.map((p) => ({ date: p.date, value: timed ? durationOf(p) : repBased ? p.reps : p.volume }))}
                color={colors.chart2}
                formatValue={timed ? formatSeconds : repBased ? value => `${formatNumber(value)} повт.` : formatKg}
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
                    <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                      {timed ? durationOf(p.topSet) > 0 ? formatSeconds(durationOf(p.topSet)) : "Время не указано" : repBased ? `${p.topSet.reps} повт.${p.topSet.weightKg > 0 ? ` + ${formatKg(p.topSet.weightKg)}` : ""}` : `${formatKg(p.topSet.weightKg)} × ${p.topSet.reps}`}
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
