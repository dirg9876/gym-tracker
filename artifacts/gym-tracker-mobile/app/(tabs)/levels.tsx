import { Feather } from "@expo/vector-icons";
import { type Level, type MainExerciseStat, useGetLevels } from "@workspace/api-client-react";
import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelForecastCard } from "@/components/LevelForecastCard";
import { ProfileCard } from "@/components/ProfileCard";
import { useColors } from "@/hooks/useColors";
import { formatKg, formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/levelImages";

export default function LevelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const ladderTopRef = useRef<number | null>(null);
  const rowYRef = useRef<Map<number, number>>(new Map());
  const { data, isLoading } = useGetLevels();

  useEffect(() => {
    if (!data) return;
    setTimeout(() => {
      const y = rowYRef.current.get(data.currentLevel);
      const top = ladderTopRef.current;
      if (y != null && top != null && scrollRef.current) {
        scrollRef.current.scrollTo({ y: top + y - 120, animated: true });
      }
    }, 250);
  }, [data]);

  if (isLoading || !data) {
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

  const { levels, currentLevel, bestLevelEver, stats } = data;
  const current: Level = levels[currentLevel];
  const next: Level | undefined = levels[currentLevel + 1];

  const passedExercises = next
    ? stats.mainExercises.filter((e) => e.maxWeightKg >= next.benchmarkKg)
    : [];
  const passedCount = passedExercises.length;
  const exerciseProgress = next
    ? Math.min(100, (passedCount / next.mainExercisesRequired) * 100)
    : 100;
  const nextTonnageTarget = data.nextLevelTonnage7dKgRequired ?? 0;
  const tonnageProgress =
    next && nextTonnageTarget > 0
      ? Math.min(100, (stats.currentTonnageSinceLevelUp / nextTonnageTarget) * 100)
      : 100;

  const droppedFromBest = bestLevelEver > currentLevel;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {/* Hero */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
        }}
      >
        <View style={{ marginBottom: 16 }}>
          <ProfileCard />
        </View>

        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 11,
            fontFamily: "Inter_700Bold",
            letterSpacing: 1.2,
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Твой уровень
        </Text>
        <View style={{ alignItems: "center", gap: 10 }}>
          <View>
            <Image
              source={levelImage(current.level, current.tier)}
              style={{ width: 144, height: 144 }}
              contentFit="contain"
            />
            <View
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                backgroundColor: colors.primary,
                borderRadius: 22,
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                }}
              >
                {current.level}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold" }}>
            {current.name}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            {current.description}
          </Text>
          {droppedFromBest ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: colors.amberSoft,
                borderWidth: 1,
                borderColor: colors.amber,
              }}
            >
              <Feather name="star" size={12} color={colors.amber} />
              <Text style={{ color: colors.amber, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                Лучший — {bestLevelEver}. Верни форму!
              </Text>
            </View>
          ) : null}
        </View>

        {next ? (
          <View style={{ marginTop: 22, gap: 12 }}>
            <LevelForecastCard />
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1,
                borderRadius: 18,
                padding: 14,
                gap: 14,
              }}
            >
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 11,
                fontFamily: "Inter_700Bold",
                letterSpacing: 1.1,
                textTransform: "uppercase",
              }}
            >
              До уровня {next.level} — «{next.name}»
            </Text>

            <ProgressRow
              icon={<Feather name="square" size={14} color={colors.mutedForeground} />}
              label={`Основные упражнения от ${formatKg(next.benchmarkKg)}`}
              valueText={`${formatNumber(passedCount)} / ${next.mainExercisesRequired}`}
              progress={exerciseProgress}
              reached={passedCount >= next.mainExercisesRequired}
            />
            <MainExercisesGrid exercises={stats.mainExercises} target={next.benchmarkKg} />

            <ProgressRow
              icon={<Feather name="zap" size={14} color={colors.mutedForeground} />}
              label="Тоннаж за 7 дней"
              valueText={`${formatNumber(stats.currentTonnageSinceLevelUp)} / ${formatNumber(nextTonnageTarget)} кг`}
              progress={tonnageProgress}
              reached={stats.currentTonnageSinceLevelUp >= nextTonnageTarget}
            />

            </View>
          </View>
        ) : (
          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: colors.card,
              borderColor: colors.primary,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
            }}
          >
            <Feather name="award" size={22} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
              Максимальный уровень. Ты — легенда.
            </Text>
          </View>
        )}
      </View>

      {/* Ladder */}
      <View
        style={{ paddingHorizontal: 16, paddingTop: 18 }}
        onLayout={(e) => {
          ladderTopRef.current = e.nativeEvent.layout.y;
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 16,
            fontFamily: "Inter_700Bold",
            marginBottom: 10,
          }}
        >
          Лестница уровней
        </Text>
        <View style={{ gap: 8 }}>
          {levels.map((lvl) => {
            const isCurrent = lvl.level === currentLevel;
            const isUnlocked = lvl.level <= currentLevel;
            const isNext = lvl.level === currentLevel + 1;
            return (
              <View
                key={lvl.level}
                onLayout={(e) => {
                  rowYRef.current.set(lvl.level, e.nativeEvent.layout.y);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isCurrent
                    ? colors.primary
                    : isNext
                      ? colors.primaryRing
                      : colors.cardBorder,
                  backgroundColor: isCurrent
                    ? colors.primarySoft
                    : isUnlocked
                      ? colors.card
                      : colors.muted,
                  opacity: isUnlocked ? 1 : 0.6,
                }}
              >
                <Image
                  source={levelImage(lvl.level, lvl.tier)}
                  style={{ width: 44, height: 44 }}
                  contentFit="contain"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                      style={{
                        color: isUnlocked ? colors.primary : colors.mutedForeground,
                        fontSize: 11,
                        fontFamily: "Inter_700Bold",
                        letterSpacing: 0.6,
                      }}
                    >
                      LVL {lvl.level}
                    </Text>
                    {isCurrent ? (
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primaryForeground,
                            fontSize: 9,
                            fontFamily: "Inter_700Bold",
                            letterSpacing: 0.6,
                          }}
                        >
                          СЕЙЧАС
                        </Text>
                      </View>
                    ) : null}
                    {!isUnlocked ? (
                      <Feather name="lock" size={11} color={colors.mutedForeground} />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: isUnlocked ? colors.foreground : colors.mutedForeground,
                      fontSize: 14,
                      fontFamily: "Inter_700Bold",
                    }}
                    numberOfLines={1}
                  >
                    {lvl.name}
                  </Text>
                  <Text
                    style={{ color: colors.mutedForeground, fontSize: 11 }}
                    numberOfLines={1}
                  >
                    {lvl.description}
                  </Text>
                  {lvl.level > 0 ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      3 упр. от {formatKg(lvl.benchmarkKg)} · {formatNumber(lvl.tonnage7dKgRequired)} кг / 7 дней
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function ProgressRow({
  icon,
  label,
  valueText,
  progress,
  reached,
}: {
  icon: React.ReactNode;
  label: string;
  valueText: string;
  progress: number;
  reached: boolean;
}) {
  const colors = useColors();
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
          {icon}
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
            {label}
          </Text>
        </View>
        <Text
          style={{
            color: reached ? colors.primary : colors.foreground,
            fontSize: 12,
            fontFamily: "Inter_700Bold",
          }}
        >
          {valueText}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: colors.muted,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${progress}%`,
            backgroundColor: colors.primary,
          }}
        />
      </View>
    </View>
  );
}

function MainExercisesGrid({
  exercises,
  target,
}: {
  exercises: MainExerciseStat[];
  target: number;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      {exercises.map((e) => {
        const passed = e.maxWeightKg >= target;
        return (
          <View
            key={e.exerciseId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: passed ? colors.primaryRing : colors.cardBorder,
              backgroundColor: passed ? colors.primarySoft : colors.muted,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Feather
                name={passed ? "check-circle" : "circle"}
                size={13}
                color={passed ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={{
                  color: passed ? colors.foreground : colors.mutedForeground,
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {e.name}
              </Text>
            </View>
            <Text
              style={{
                color: passed ? colors.primary : colors.mutedForeground,
                fontSize: 12,
                fontFamily: "Inter_700Bold",
              }}
            >
              {formatNumber(e.maxWeightKg)} кг
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({});
