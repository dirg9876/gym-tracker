import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListExercisesQueryKey,
  useCreateExercise,
  useDeleteExercise,
  useListExercises,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";

export default function ExercisesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const { data: exercises, isLoading } = useListExercises();

  const createExercise = useCreateExercise({
    mutation: {
      onSuccess: () => {
        setNewName("");
        setNewGroup("");
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        toast.show("success", "Упражнение создано");
      },
      onError: () => toast.show("error", "Не удалось создать"),
    },
  });

  const deleteExercise = useDeleteExercise({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        toast.show("success", "Удалено");
      },
    },
  });

  const filtered = useMemo(() => {
    if (!exercises) return [];
    const q = search.toLowerCase();
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q),
    );
  }, [exercises, search]);

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
        <Button
          icon={<Feather name="plus" size={16} color={colors.primaryForeground} />}
          title="Добавить"
          fullWidth
          onPress={() =>
            createExercise.mutate({ data: { name: newName, muscleGroup: newGroup } })
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
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontFamily: "Inter_500Medium",
                        flex: 1,
                      }}
                    >
                      {ex.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
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
  inputWrap: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
  },
  input: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
