import Feather from "@expo/vector-icons/Feather";
import { useGetLevels } from "@workspace/api-client-react";
import { NORM_SOURCE_URL } from "@workspace/level-data/strength";
import { Image } from "expo-image";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, Text, View } from "react-native";
import { AthleteProfile } from "@/components/AthleteProfile";
import { useColors } from "@/hooks/useColors";
import { levelImage } from "@/lib/levelImages";
import { isExercisePassed, targetForExerciseLevel, type ExerciseLevelsResponse } from "@/lib/levelProgress";
import { formatStandard, standardProgress } from "@/lib/exerciseStandards";

export default function LevelsScreen() {
  const colors = useColors();
  const { data, isLoading, refetch, isError } = useGetLevels<ExerciseLevelsResponse>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (isLoading) return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  if (!data || isError) return <Pressable onPress={() => refetch()} style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: 24 }}><Text style={{ color: colors.foreground }}>Не удалось загрузить уровни. Повторить</Text></Pressable>;
  const { levels, currentLevel, stats } = data;
  const current = levels[currentLevel];
  const next = levels[currentLevel + 1];
  const passed = stats.mainExercises.filter(item => isExercisePassed(item, data.bodyWeightKg)).length;
  const visibleExercises = showAll ? stats.mainExercises : stats.mainExercises.slice(0, 3);
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
            {data.currentRank.code !== "NONE" ? <Text style={{ color: colors.success, fontSize: 14 }}>Ступень прогресса: {data.currentRank.label}</Text> : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>{current.description}</Text>
          </View>
          <AthleteProfile sex={data.sex} bodyWeightKg={data.bodyWeightKg} fallback={data.bodyWeightIsFallback} />
          <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>
            {next ? `До уровня ${next.level}: ${next.name}` : "Высшая ступень в любых трёх упражнениях"}
          </Text>
          {next ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Любые три упражнения: {Math.min(3, passed)} / 3</Text> : null}
          {visibleExercises.map(item => {
            const target = item.requiredValueForNextLevel ?? targetForExerciseLevel(item.standard, item.equipment, 80);
            const done = item.hasRecordedResult && item.bestValue >= target;
            const rank = standardProgress(item.standard, item.bestValue);
            return (
              <View key={item.exerciseId} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name={done ? "check-circle" : "circle"} size={16} color={done ? colors.success : colors.mutedForeground} />
                  <Text style={{ flex: 1, color: done ? colors.success : colors.foreground, fontSize: 13 }}>{item.name}{item.archived ? " · архив" : ""}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <Text style={{ color: done ? colors.success : colors.foreground, fontSize: 12 }}>{formatStandard(item.bestValue, item.standard.unit)} / {formatStandard(target, item.standard.unit)}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.standard.official ? rank.rank.label : `Ориентир ${rank.rank.shortLabel}`}: {formatStandard(rank.target, item.standard.unit)}{rank.atMaximum ? " · достигнут" : ` · ещё ${formatStandard(rank.remaining, item.standard.unit)}`}</Text>
                </View>
                <View style={{ height: 5, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ height: 5, width: `${Math.min(100, item.bestValue / Math.max(target, 1) * 100)}%`, backgroundColor: done ? colors.success : colors.primary }} />
                </View>
              </View>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name={showAll ? "chevron-up" : "list"} size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13 }}>{showAll ? "Свернуть упражнения" : `Все упражнения (${stats.mainExercises.length})`}</Text>
          </Pressable>
          <View style={{ gap: 5 }}>
            <Text style={{ color: colors.foreground, fontSize: 12 }}>WRPF · без экипировки · допинг-контроль</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Официальные нормативы: жим, присед и тяга. Остальные упражнения: расчётные ориентиры в кг, повторах или секундах, не присвоенные спортивные разряды.</Text>
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
                {selected && level.level > 0 ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Любые три упражнения из списка</Text> : null}
                {selected && level.level > 0 ? visibleExercises.map(item => (
                  <View key={item.exerciseId} style={{ flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
                    <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>{item.name}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12 }}>{formatStandard(targetForExerciseLevel(item.standard, item.equipment, level.level), item.standard.unit)}</Text>
                  </View>
                )) : null}
              </Pressable>
            );
      }}
    />
  );
}
