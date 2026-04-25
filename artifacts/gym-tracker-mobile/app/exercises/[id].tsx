import { Feather } from "@expo/vector-icons";
import {
  getGetExerciseProgressQueryKey,
  getGetExerciseNormsQueryKey,
  useGetExerciseProgress,
  useGetExerciseNorms,
  type ExerciseRankNorms,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { LineChart } from "@/components/LineChart";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";

// Rank tier → colour accent (matches web RankBadge tier styling)
function tierColor(tier: number): string {
  if (tier >= 8) return "#f59e0b"; // МС — gold
  if (tier >= 7) return "#eab308"; // КМС — yellow
  if (tier >= 6) return "#d1d5db"; // I р. — silver
  if (tier >= 5) return "#9ca3af"; // II р. — cool gray
  if (tier >= 4) return "#f97316"; // III р. — orange
  if (tier >= 3) return "#94a3b8"; // Юн I — slate
  if (tier >= 2) return "#94a3b8"; // Юн II
  if (tier >= 1) return "#94a3b8"; // Юн III
  return "#6b7280";               // Б/Р — muted
}

function RankChip({
  shortLabel,
  tier,
  colors,
}: {
  shortLabel: string;
  tier: number;
  colors: ReturnType<typeof useColors>;
}) {
  const accent = tierColor(tier);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: accent + "60",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: accent + "18",
      }}
    >
      <Text
        style={{
          color: accent,
          fontSize: 11,
          fontFamily: "Inter_700Bold",
          letterSpacing: 0.2,
        }}
      >
        {shortLabel}
      </Text>
    </View>
  );
}

function RankLadder({
  norms,
  maxWeight,
  colors,
}: {
  norms: ExerciseRankNorms;
  maxWeight: number;
  colors: ReturnType<typeof useColors>;
}) {
  const { rankNorms, currentRank, nextRank, kgToNextRank, mcKg } = norms;

  if (mcKg == null) {
    return (
      <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", padding: 8 }}>
        Упражнение на время — разряды по кг не применяются
      </Text>
    );
  }

  if (maxWeight === 0) {
    return (
      <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center", padding: 8 }}>
        Зафиксируй результат, чтобы увидеть свой разряд
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {/* Hero: current rank + delta */}
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {currentRank ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: tierColor(currentRank.tier) + "60",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: tierColor(currentRank.tier) + "22",
            }}
          >
            <Text
              style={{
                color: tierColor(currentRank.tier),
                fontSize: 14,
                fontFamily: "Inter_700Bold",
              }}
            >
              {currentRank.label}
            </Text>
          </View>
        ) : null}
        {nextRank && kgToNextRank != null && (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            до {nextRank.shortLabel}: +{formatKg(kgToNextRank)}
          </Text>
        )}
        {!nextRank && currentRank?.code === "MS" && (
          <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
            Норматив МС выполнен!
          </Text>
        )}
      </View>

      {/* Ladder rows (МС → Б/Р) */}
      <View style={{ gap: 2 }}>
        {[...rankNorms].reverse().map((entry) => {
          const isCurrent = currentRank?.code === entry.rank.code;
          const isNext = nextRank?.code === entry.rank.code;
          const passed = maxWeight >= entry.kgTarget && entry.kgTarget > 0;
          const accent = tierColor(entry.rank.tier);
          return (
            <View
              key={entry.rank.code}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 8,
                borderWidth: isCurrent ? 1 : isNext ? 1 : 0,
                borderStyle: isNext && !isCurrent ? "dashed" : "solid",
                borderColor: isCurrent ? colors.primary + "50" : isNext ? colors.primary + "30" : "transparent",
                backgroundColor: isCurrent ? colors.primary + "18" : "transparent",
              }}
            >
              <RankChip shortLabel={entry.rank.shortLabel} tier={entry.rank.tier} colors={colors} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {entry.kgTarget === 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>старт</Text>
                ) : (
                  <>
                    <Text
                      style={{
                        color: passed ? colors.primary : colors.mutedForeground,
                        fontSize: 12,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {formatKg(entry.kgTarget)}
                    </Text>
                    {isNext && kgToNextRank != null && (
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                        (+{formatKg(kgToNextRank)})
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: "center" }}>
        Норматив МС: {formatKg(mcKg)}
      </Text>
    </View>
  );
}

export default function ExerciseProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = parseInt(params.id || "0", 10);

  const { data: progress, isLoading } = useGetExerciseProgress(id, {
    query: { enabled: !!id, queryKey: getGetExerciseProgressQueryKey(id) },
  });

  const { data: normsData } = useGetExerciseNorms(id, {
    query: { enabled: !!id, queryKey: getGetExerciseNormsQueryKey(id) },
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

        {/* Rank ladder */}
        {normsData && (
          <Card padding={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Feather name="award" size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>
                Спортивный разряд
              </Text>
            </View>
            <RankLadder norms={normsData} maxWeight={maxWeight} colors={colors} />
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
                    <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" }}>
                      {formatKg(p.topSet.weightKg)}{" "}
                      <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_400Regular" }}>
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
