import Feather from "@expo/vector-icons/Feather";
import { useGetLevels } from "@workspace/api-client-react";
import { NORM_SOURCE_URL, liftForExercise, rankNorms, requiredStrengthKg } from "@workspace/level-data/strength";
import { Image } from "expo-image";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, Text, View } from "react-native";
import { AthleteProfile } from "@/components/AthleteProfile";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";
import { levelImage } from "@/lib/levelImages";
import { isExercisePassed } from "@/lib/levelProgress";
import { nextRankHint } from "@/lib/rankHint";

export default function LevelsScreen() {
  const colors = useColors();
  const { data, isLoading, refetch, isError } = useGetLevels();
  const [expanded, setExpanded] = useState<number | null>(null);
  if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  if (!data || isError) return <Pressable onPress={() => refetch()} style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 }}><Text style={{ color: colors.foreground }}>Не удалось загрузить уровни. Повторить</Text></Pressable>;
  const { levels, currentLevel, stats } = data;
  const current = levels[currentLevel];
  const next = levels[currentLevel + 1];
  const passed = stats.mainExercises.filter(item => isExercisePassed(item, data.bodyWeightKg)).length;
  const openSource = () => Linking.openURL(NORM_SOURCE_URL).catch(() => Alert.alert("Не удалось открыть источник"));
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 24 }}
      data={levels}
      extraData={expanded}
      keyExtractor={level => String(level.level)}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListHeaderComponent={<>
        <View style={{ padding: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
          <View style={{ alignItems: "center", gap: 6 }}>
            <Image source={levelImage(current.level, current.tier)} style={{ width: 120, height: 120 }} contentFit="contain" />
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_700Bold" }}>УРОВЕНЬ {currentLevel} / 80</Text>
            <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" }}>{current.name}</Text>
            {data.currentRank.code !== "NONE" ? <Text style={{ color: colors.success, fontSize: 14 }}>Тренировочные результаты на уровне {data.currentRank.label}</Text> : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>{current.description}</Text>
          </View>
          <AthleteProfile sex={data.sex} bodyWeightKg={data.bodyWeightKg} fallback={data.bodyWeightIsFallback} />
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>
            {next ? `До уровня ${next.level}: ${next.name}` : "Три тренировочных результата не ниже целей МСМК"}
          </Text>
          {next ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Дисциплины: {passed} / 3</Text> : null}
          {stats.mainExercises.map(item => {
            const target = item.requiredKgForNextLevel ?? item.mcKg ?? 0;
            const done = item.maxWeightKg >= target;
            const rank = nextRankHint({ mcKg: item.mcKg, rankNorms: rankNorms(liftForExercise(item.name)!, data.bodyWeightKg, data.sex) }, item.maxWeightKg);
            return (
              <View key={item.exerciseId} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name={done ? "check-circle" : "circle"} size={16} color={done ? colors.success : colors.mutedForeground} />
                  <Text style={{ flex: 1, color: done ? colors.success : colors.foreground, fontSize: 13 }}>{item.name}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12 }}>{formatNumber(item.maxWeightKg)} / {formatNumber(target)} кг</Text>
                  {rank ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{rank.rank.label}: {formatNumber(rank.kgTarget)} кг{rank.atMaximum ? " · достигнут" : ` · ещё ${formatNumber(rank.remainingKg)} кг`}</Text> : null}
                </View>
                <View style={{ height: 5, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: 5, width: `${Math.min(100, item.maxWeightKg / Math.max(target, 1) * 100)}%`, backgroundColor: done ? colors.success : colors.primary }} />
                </View>
              </View>
            );
          })}
          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.foreground, fontSize: 12 }}>WRPF · без экипировки · допинг-контроль</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Опорные ступени: III, II, I, КМС, МС, МСМК. Сравнение тренировочных результатов, не присвоение спортивного звания.</Text>
            <Pressable accessibilityRole="link" onPress={openSource} style={{ paddingVertical: 8, flexDirection: "row", gap: 6 }}>
              <Feather name="external-link" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12 }}>Источники: WRPF 2019 / таблица приседа 2025</Text>
            </Pressable>
          </View>
        </View>
        <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold", padding: 16 }}>Лестница уровней</Text>
      </>}
      renderItem={({ item: level }) => {
            const selected = expanded === level.level;
            const unlocked = level.level <= currentLevel;
            return (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: selected }} onPress={() => setExpanded(selected ? null : level.level)} style={{ marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: level.level === currentLevel ? colors.primary : colors.cardBorder, backgroundColor: colors.card, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image source={levelImage(level.level, level.tier)} style={{ width: 44, height: 44 }} contentFit="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: unlocked ? colors.success : colors.mutedForeground, fontSize: 11 }}>УРОВЕНЬ {level.level}{level.level === currentLevel ? " · ТЕКУЩИЙ" : unlocked ? " · ПРОЙДЕН" : ""}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>{level.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{level.description}</Text>
                    {level.rank.code !== "NONE" ? <Text style={{ color: unlocked ? colors.success : colors.mutedForeground, fontSize: 11, marginTop: 4 }}>Ступень: {level.rank.label}</Text> : null}
                  </View>
                  <Feather name={selected ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </View>
                {selected && level.level > 0 ? stats.mainExercises.map(item => (
                  <View key={item.exerciseId} style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
                    <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{item.name}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12 }}>{formatNumber(requiredStrengthKg(liftForExercise(item.name)!, level.level, data.bodyWeightKg, data.sex))} кг</Text>
                  </View>
                )) : null}
              </Pressable>
            );
      }}
    />
  );
}
