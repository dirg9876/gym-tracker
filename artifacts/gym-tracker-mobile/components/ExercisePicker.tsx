import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Exercise } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/Button";

type Props = {
  exercises: Exercise[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onCreate: (name: string, muscleGroup: string) => void;
};

export function ExercisePicker({ exercises, selectedId, onSelect, onCreate }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const selected = exercises.find((e) => e.id === selectedId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q),
    );
  }, [exercises, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Exercise[]> = {};
    for (const ex of filtered) {
      if (!groups[ex.muscleGroup]) groups[ex.muscleGroup] = [];
      groups[ex.muscleGroup].push(ex);
    }
    return Object.entries(groups);
  }, [filtered]);

  const flatData = useMemo(() => {
    type Row =
      | { type: "header"; key: string; group: string }
      | { type: "item"; key: string; ex: Exercise };
    const rows: Row[] = [];
    for (const [group, list] of grouped) {
      rows.push({ type: "header", key: `h-${group}`, group });
      for (const ex of list) rows.push({ type: "item", key: `e-${ex.id}`, ex });
    }
    return rows;
  }, [grouped]);

  const handleCreate = () => {
    const name = newName.trim();
    const group = newGroup.trim();
    if (!name || !group) return;
    onCreate(name, group);
    setNewName("");
    setNewGroup("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: colors.muted,
            borderColor: colors.cardBorder,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Упражнение</Text>
          {selected ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={[styles.value, { color: colors.foreground }]} numberOfLines={1}>
                {selected.name}
              </Text>
              <Text style={[styles.muscle, { color: colors.primary }]}>
                {selected.muscleGroup}
              </Text>
            </View>
          ) : (
            <Text style={[styles.value, { color: colors.mutedForeground }]}>Выбрать</Text>
          )}
        </View>
        <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderColor: colors.cardBorder,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {creating ? "Новое упражнение" : "Упражнения"}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {creating ? (
              <View style={{ gap: 12 }}>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                  <TextInput
                    placeholder="Название"
                    placeholderTextColor={colors.mutedForeground}
                    value={newName}
                    onChangeText={setNewName}
                    style={[styles.input, { color: colors.foreground }]}
                  />
                </View>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                  <TextInput
                    placeholder="Группа мышц"
                    placeholderTextColor={colors.mutedForeground}
                    value={newGroup}
                    onChangeText={setNewGroup}
                    style={[styles.input, { color: colors.foreground }]}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    variant="secondary"
                    title="Отмена"
                    size="md"
                    style={{ flex: 1 }}
                    onPress={() => setCreating(false)}
                  />
                  <Button
                    title="Добавить"
                    size="md"
                    style={{ flex: 2 }}
                    disabled={!newName.trim() || !newGroup.trim()}
                    onPress={handleCreate}
                  />
                </View>
              </View>
            ) : (
              <>
                <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                  <Feather name="search" size={16} color={colors.mutedForeground} />
                  <TextInput
                    placeholder="Поиск..."
                    placeholderTextColor={colors.mutedForeground}
                    value={search}
                    onChangeText={setSearch}
                    style={[styles.searchInput, { color: colors.foreground }]}
                  />
                </View>

                <FlatList
                  data={flatData}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => {
                    if (item.type === "header") {
                      return (
                        <Text
                          style={[styles.groupHeader, { color: colors.primary }]}
                        >
                          {item.group.toUpperCase()}
                        </Text>
                      );
                    }
                    const ex = item.ex;
                    const active = ex.id === selectedId;
                    return (
                      <Pressable
                        onPress={() => {
                          onSelect(ex.id);
                          setOpen(false);
                        }}
                        style={({ pressed }) => [
                          styles.exRow,
                          {
                            backgroundColor: active ? colors.primarySoft : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.exName,
                            { color: active ? colors.primary : colors.foreground },
                          ]}
                        >
                          {ex.name}
                        </Text>
                        {active ? (
                          <Feather name="check" size={18} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  style={{ flexGrow: 0, maxHeight: 380 }}
                  ListEmptyComponent={
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", paddingVertical: 24 }}>
                      Ничего не найдено
                    </Text>
                  }
                  keyboardShouldPersistTaps="handled"
                />

                <Button
                  variant="secondary"
                  title="Создать своё"
                  icon={<Feather name="plus" size={16} color={colors.foreground} />}
                  onPress={() => setCreating(true)}
                  fullWidth
                  style={{ marginTop: 12 }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  value: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  muscle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  groupHeader: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  exRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exName: { fontSize: 16, fontFamily: "Inter_500Medium" },
  inputWrap: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
  },
  input: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
