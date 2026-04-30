import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLevelsQueryKey,
  getListExercisesQueryKey,
  useCreateExercise,
  useDeleteExercise,
  useListExercises,
  useUpdateExercise,
  type Equipment,
  type SportRank,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function tierAccent(tier: number): string {
  if (tier >= 8) return "#f59e0b";
  if (tier >= 7) return "#eab308";
  if (tier >= 6) return "#d1d5db";
  if (tier >= 5) return "#9ca3af";
  if (tier >= 4) return "#f97316";
  if (tier >= 1) return "#94a3b8";
  return "#6b7280";
}

function RankPill({ rank }: { rank: SportRank }) {
  if (rank.code === "NONE") return null;
  const color = tierAccent(rank.tier);
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: color + "55",
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 1,
        backgroundColor: color + "18",
        marginRight: 4,
      }}
    >
      <Text style={{ color, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.1 }}>
        {rank.shortLabel}
      </Text>
    </View>
  );
}

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { EQUIPMENT_OPTIONS, equipmentLabel } from "@/lib/equipment";

export default function ExercisesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [onlyMain, setOnlyMain] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newEquipment, setNewEquipment] = useState<Equipment>("other");

  const { data: exercises, isLoading } = useListExercises();

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: () => {
        setNewName("");
        setNewGroup("");
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        toast.show("success", "Упражнение создано");
      },
      onError: () => toast.show("error", "Не удалось создать"),
    },
  });

  const deleteExercise = useDeleteExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        toast.show("success", "Удалено");
      },
    },
  });

  const updateExercise = useUpdateExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
      },
      onError: () => toast.show("error", "Не удалось обновить"),
    },
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    return exercises.filter((e) => {
      if (onlyMain && !e.isMain) return false;
      return e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q);
    });
  }, [exercises, search, onlyMain]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const ex of filtered) {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    }
    return Object.entries(groups);
  }, [filtered]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
    >
      <Text style={[styles.h1, { color: colors.foreground }]}>Упражнения</Text>

      <View
        style={[
          styles.searchWrap,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          placeholder="Поиск..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      <Pressable
        onPress={() => setOnlyMain((next) => !next)}
        style={({ pressed }) => [
          styles.onlyMain,
          {
            backgroundColor: onlyMain ? colors.primarySoft : colors.card,
            borderColor: onlyMain ? colors.primary : colors.cardBorder,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Feather name="star" size={16} color={onlyMain ? colors.primary : colors.mutedForeground} />
        <Text
          style={[
            styles.onlyMainText,
            { color: onlyMain ? colors.primary : colors.mutedForeground },
          ]}
        >
          Только основные
        </Text>
      </Pressable>

      <Card padding={16}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 11,
            fontFamily: "Inter_700Bold",
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Новое упражнение
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <View
            style={[
              styles.inputWrap,
              { flex: 2, backgroundColor: colors.background, borderColor: colors.cardBorder },
            ]}
          >
            <TextInput
              placeholder="Название"
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
          <View
            style={[
              styles.inputWrap,
              { flex: 1, backgroundColor: colors.background, borderColor: colors.cardBorder },
            ]}
          >
            <TextInput
              placeholder="Группа"
              placeholderTextColor={colors.mutedForeground}
              value={newGroup}
              onChangeText={setNewGroup}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
        </View>
        <View style={styles.equipmentRow}>
          {EQUIPMENT_OPTIONS.map((option) => {
            const active = newEquipment === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setNewEquipment(option.value)}
                style={({ pressed }) => [
                  styles.equipmentChip,
                  {
                    backgroundColor: active ? colors.primarySoft : colors.background,
                    borderColor: active ? colors.primary : colors.cardBorder,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={1}
                  style={[
                    styles.equipmentText,
                    { color: active ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {option.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          icon={<Feather name="plus" size={16} color={colors.primaryForeground} />}
          title="Добавить"
          fullWidth
          onPress={() =>
            createExercise.mutate({
              data: { name: newName, muscleGroup: newGroup, equipment: newEquipment },
            })
          }
          disabled={!newName || !newGroup || createExercise.isPending}
        />
      </Card>

      {isLoading ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          {grouped.map(([group, list]) => (
            <View key={group} style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  fontFamily: "Inter_700Bold",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  paddingHorizontal: 6,
                }}
              >
                {group}
              </Text>
              <Card padding={0}>
                {list.map((ex, i) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => router.push(`/exercises/${ex.id}`)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.cardBorder,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          updateExercise.mutate({
                            exerciseId: ex.id,
                            data: { isMain: !ex.isMain },
                          });
                        }}
                        hitSlop={8}
                        style={({ pressed }) => ({
                          width: 30,
                          height: 30,
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: pressed ? 0.6 : 1,
                        })}
                      >
                        <Feather
                          name="star"
                          size={18}
                          color={ex.isMain ? colors.primary : colors.mutedForeground}
                        />
                      </Pressable>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 15,
                          fontFamily: "Inter_500Medium",
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {ex.name}
                      </Text>
                      {ex.userRank && ex.userRank.code !== "NONE" && (
                        <RankPill rank={ex.userRank} />
                      )}
                      {ex.isMain && ex.mcKg != null ? (
                        <View style={[styles.mcPill, { backgroundColor: colors.primarySoft }]}>
                          <Text style={[styles.mcText, { color: colors.primary }]}>
                            МС: {Math.round(ex.mcKg)} кг
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {ex.isCustom ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            const currentIndex = EQUIPMENT_OPTIONS.findIndex((o) => o.value === ex.equipment);
                            const next =
                              EQUIPMENT_OPTIONS[(currentIndex + 1) % EQUIPMENT_OPTIONS.length]!;
                            updateExercise.mutate({
                              exerciseId: ex.id,
                              data: { equipment: next.value },
                            });
                          }}
                          style={({ pressed }) => [
                            styles.rowEquipment,
                            {
                              borderColor: colors.cardBorder,
                              backgroundColor: colors.background,
                              opacity: pressed ? 0.75 : 1,
                            },
                          ]}
                        >
                          <Text
                            adjustsFontSizeToFit
                            minimumFontScale={0.74}
                            numberOfLines={1}
                            style={[styles.rowEquipmentText, { color: colors.mutedForeground }]}
                          >
                            {equipmentLabel(ex.equipment)}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text
                          numberOfLines={1}
                          style={[styles.staticEquipment, { color: colors.mutedForeground }]}
                        >
                          {equipmentLabel(ex.equipment)}
                        </Text>
                      )}
                      {ex.isCustom ? (
                        <Pressable
                          onPress={() => deleteExercise.mutate({ exerciseId: ex.id })}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: pressed ? colors.destructiveSoft : "transparent",
                          })}
                        >
                          <Feather name="trash-2" size={15} color={colors.destructive} />
                        </Pressable>
                      ) : null}
                      <Feather
                        name="chevron-right"
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </Pressable>
                ))}
              </Card>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  onlyMain: {
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlyMainText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  inputWrap: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  input: { fontSize: 14, fontFamily: "Inter_500Medium" },
  equipmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  equipmentChip: {
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  rowEquipment: {
    maxWidth: 86,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowEquipmentText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  mcPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mcText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  staticEquipment: {
    maxWidth: 74,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
});
