import Feather from "@expo/vector-icons/Feather";
import { useGetLevels } from "@workspace/api-client-react";
import { NORM_SOURCE_URL } from "@workspace/level-data/strength";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, Text, View, useWindowDimensions } from "react-native";
import { AthleteProfile } from "@/components/AthleteProfile";
import { ProgressTrack } from "@/components/ProgressTrack";
import { LevelPortrait } from "@/components/LevelPortrait";
import { useColors } from "@/hooks/useColors";
import { exerciseLevelGoal, isExercisePassed, type ExerciseLevelsResponse } from "@/lib/levelProgress";
import { formatStandard, standardProgress } from "@/lib/exerciseStandards";
import { isAssisted } from "@/lib/equipmentSettings";

export default function LevelsScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { data, isLoading, refetch, isError } = useGetLevels<ExerciseLevelsResponse>();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showSource, setShowSource] = useState(false);
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
      ListHeaderComponent={<>
        <View style={{ padding: 20, gap: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_700Bold" }}>ТЕКУЩИЙ УРОВЕНЬ</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 52, lineHeight: 60, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{currentLevel}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>/ 80</Text>
              </View>
            </View>
            <LevelPortrait level={current.level} tier={current.tier} sex={data.sex} label={current.name} size={width >= 400 ? 192 : 160} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 21, lineHeight: 29, fontFamily: "Inter_700Bold" }}>{current.name}</Text>
          <ProgressTrack value={currentLevel} total={80} label={`Уровень ${currentLevel} из 80`} segmented />
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>{current.description}</Text>
          {data.currentRank.code !== "NONE" ? <Text style={{ color: colors.success, fontSize: 13 }}>Ступень прогресса: {data.currentRank.label}</Text> : null}
        </View>
        <View style={{ padding: 20, gap: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
          <AthleteProfile sex={data.sex} bodyWeightKg={data.bodyWeightKg} fallback={data.bodyWeightIsFallback} />
          <Text style={{ color: colors.accent, fontSize: 10, fontFamily: "Inter_700Bold" }}>{next ? "СЛЕДУЮЩАЯ СТУПЕНЬ" : "ВЕРШИНА ДОСТИГНУТА"}</Text>
          <Text style={{ color: colors.foreground, fontSize: 18, lineHeight: 26, fontFamily: "Inter_700Bold" }}>
            {next ? `${next.level} · ${next.name}` : "Высшая ступень в любых трёх упражнениях"}
          </Text>
          {next ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <View accessible accessibilityLabel={`Выполнено ${Math.min(3, passed)} из трёх упражнений`} style={{ flexDirection: "row", gap: 6 }}>
              {[0, 1, 2].map(index => <View key={index} style={{ width: 30, height: 30, borderRadius: 4, borderWidth: 1, borderColor: index < passed ? colors.successBorder : colors.cardBorder, backgroundColor: index < passed ? colors.successSoft : colors.card, justifyContent: "center", alignItems: "center" }}>{index < passed ? <Feather name="check" size={16} color={colors.success} /> : <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{index + 1}</Text>}</View>)}
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Любые три упражнения · {Math.min(3, passed)} / 3</Text>
          </View> : null}
          {visibleExercises.map(item => {
            const goal = exerciseLevelGoal(item, next?.level ?? 80);
            const { target, passed: done } = goal;
            const rank = standardProgress(item.standard, item.bestValue);
            return (
              <View key={item.exerciseId} style={{ gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Feather name={done ? "check-circle" : "target"} size={17} color={done ? colors.success : colors.accent} />
                  <Text style={{ flex: 1, color: done ? colors.success : colors.foreground, fontSize: 14, lineHeight: 20, fontFamily: "Inter_600SemiBold" }}>{item.name}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <Text style={{ color: done ? colors.success : colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{item.hasRecordedResult ? `${isAssisted(item) ? "Нагрузка: " : ""}${formatStandard(item.bestValue, item.standard.unit)}` : "Нет результата"}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Цель: {formatStandard(target, item.standard.unit)}</Text>
                </View>
                <ProgressTrack value={item.hasRecordedResult ? item.bestValue : 0} total={target} label={`${item.name}: до следующего уровня`} color={done ? colors.success : colors.accent} />
                <Text style={{ color: done ? colors.success : colors.accent, fontSize: 15, lineHeight: 22, fontFamily: "Inter_600SemiBold" }}>
                  {done ? `Уровень ${next?.level ?? 80}: выполнено` : goal.remaining == null ? `Цель уровня ${next?.level ?? 80}: ${formatStandard(target, item.standard.unit)} · результат не записан` : `До уровня ${next?.level ?? 80}: ещё ${formatStandard(goal.remaining, item.standard.unit)}${isAssisted(item) ? " нагрузки" : ""}`}
                </Text>
                {isAssisted(item) ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Нагрузка = вес тела минус противовес</Text> : null}
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{item.standard.official ? "WRPF" : "Расчётный ориентир"} · {rank.rank.label}: {formatStandard(rank.target, item.standard.unit)}{rank.atMaximum ? " · достигнут" : item.hasRecordedResult ? ` · ещё ${formatStandard(rank.remaining, item.standard.unit)}` : ""}</Text>
              </View>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name={showAll ? "chevron-up" : "list"} size={18} color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 13 }}>{showAll ? "Свернуть упражнения" : `Все упражнения (${stats.mainExercises.length})`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="О нормативах и расчётных ориентирах" accessibilityState={{ expanded: showSource }} onPress={() => setShowSource(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="info" size={16} color={colors.mutedForeground} /><Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }}>Нормативы и расчётные ориентиры</Text><Feather name={showSource ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} /></Pressable>
          {showSource ? <View style={{ gap: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 12 }}>WRPF · без экипировки · допинг-контроль</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 19 }}>Официальные нормативы: жим, присед и тяга. Остальные упражнения: расчётные ориентиры в кг, повторах или секундах, не присвоенные спортивные разряды.</Text>
            <Pressable accessibilityRole="link" onPress={openSource} style={{ paddingVertical: 8, flexDirection: "row", gap: 6 }}>
              <Feather name="external-link" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12 }}>Источники: WRPF 2019 / таблица приседа 2025</Text>
            </Pressable>
          </View> : null}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold", padding: 20 }}>Лестница уровней</Text>
      </>}
      renderItem={({ item: level }) => {
            const selected = expanded === level.level;
            const unlocked = level.level <= currentLevel;
            return (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: selected }} onPress={() => setExpanded(selected ? null : level.level)} style={{ borderBottomWidth: 1, borderBottomColor: colors.cardBorder, borderLeftWidth: 3, borderLeftColor: level.level === currentLevel ? colors.primary : "transparent", backgroundColor: level.level === currentLevel ? colors.primarySoft : "transparent", padding: 16, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {!selected ? <LevelPortrait level={level.level} tier={level.tier} sex={data.sex} label={level.name} size={96} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: level.level === currentLevel ? colors.primary : unlocked ? colors.success : colors.mutedForeground, fontSize: 10, fontFamily: "Inter_600SemiBold" }}>УРОВЕНЬ {level.level}{level.level === currentLevel ? " · ТЕКУЩИЙ" : unlocked ? " · ПРОЙДЕН" : ""}</Text>
                    <Text style={{ color: unlocked ? colors.success : colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" }}>{level.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{level.description}</Text>
                    {level.rank.code !== "NONE" ? <Text style={{ color: unlocked ? colors.success : colors.mutedForeground, fontSize: 11, marginTop: 4 }}>Ступень: {level.rank.label}</Text> : null}
                  </View>
                  <Feather name={selected ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </View>
                {selected ? <View style={{ alignItems: "center" }}><LevelPortrait level={level.level} tier={level.tier} sex={data.sex} label={level.name} size={216} /></View> : null}
                {selected && level.level > 0 ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Любые три упражнения из списка</Text> : null}
                {selected && level.level > 0 ? visibleExercises.map(item => {
                  const goal = exerciseLevelGoal(item, level.level);
                  return <View key={item.exerciseId} style={{ gap: 4, paddingVertical: 6 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13 }}>{item.name}</Text>
                    <Text style={{ color: goal.passed ? colors.success : colors.accent, fontSize: 12 }}>{goal.passed ? "Выполнено" : goal.remaining == null ? "Результат не записан" : `Ещё ${formatStandard(goal.remaining, item.standard.unit)}${isAssisted(item) ? " нагрузки" : ""}`} · цель {formatStandard(goal.target, item.standard.unit)}</Text>
                  </View>;
                }) : null}
              </Pressable>
            );
      }}
    />
  );
}
