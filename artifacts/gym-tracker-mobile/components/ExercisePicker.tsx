import Feather from "@expo/vector-icons/Feather";
import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Equipment, Exercise, Profile } from "@workspace/api-client-react";
import { exerciseRankHint } from "@/lib/rankHint";
import { formatStandard } from "@/lib/exerciseStandards";

import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/Button";
import { MuscleGroupPicker } from "@/components/MuscleGroupPicker";
import { EquipmentPicker } from "@/components/EquipmentPicker";

type Props = {
  exercises: Exercise[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onCreate?: (name: string, muscleGroup: string, equipment: Equipment) => Promise<unknown>;
  profile?: Profile;
  disabled?: boolean;
};

export function ExercisePicker({ exercises, selectedId, onSelect, onCreate, profile, disabled = false }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newEquipment, setNewEquipment] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const submitting = useRef(false);

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

  const handleCreate = async () => {
    const name = newName.trim();
    const group = newGroup.trim();
    if (!name || !group || !newEquipment || !onCreate || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setCreateError(null);
    try {
      await onCreate(name, group, newEquipment);
      setNewName("");
      setNewGroup("");
      setNewEquipment(null);
      setCreating(false);
      Keyboard.dismiss();
      setOpen(false);
    } catch (error) { setCreateError(error instanceof Error ? error.message : "Не удалось создать упражнение."); }
    finally { submitting.current = false; setSaving(false); }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selected ? `Упражнение: ${selected.name}` : "Выбрать упражнение"}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => { Keyboard.dismiss(); setOpen(true); }}
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
            <View style={{ gap: 2 }}>
              <Text style={[styles.value, { color: colors.foreground }]}>
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
        onRequestClose={() => { if (!submitting.current) setOpen(false); }}
      >
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Pressable style={styles.backdrop} disabled={saving} onPress={() => setOpen(false)} />
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
                accessibilityRole="button"
                accessibilityLabel="Закрыть выбор упражнения"
                disabled={saving}
                onPress={() => setOpen(false)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, width: 44, height: 44, alignItems: "center", justifyContent: "center" })}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {creating ? (
              <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 12 }}>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                  <TextInput
                    accessibilityLabel="Название упражнения"
                    placeholder="Название"
                    placeholderTextColor={colors.mutedForeground}
                    value={newName}
                    onChangeText={value => { setNewName(value); setCreateError(null); }}
                    maxLength={120}
                    editable={!saving}
                    style={[styles.input, { color: colors.foreground }]}
                  />
                </View>
                <MuscleGroupPicker value={newGroup} onChange={value => { setNewGroup(value); setCreateError(null); }} groups={exercises.map(ex => ex.muscleGroup)} disabled={saving} />
                <EquipmentPicker value={newEquipment} onChange={value => { setNewEquipment(value); setCreateError(null); }} disabled={saving} />
                {createError ? <Text accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 13 }}>{createError}</Text> : null}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button
                    variant="secondary"
                    title="Отмена"
                    size="md"
                    style={{ flex: 1 }}
                    disabled={saving}
                    onPress={() => setCreating(false)}
                  />
                  <Button
                    title="Добавить"
                    size="md"
                    style={{ flex: 2 }}
                    disabled={!newName.trim() || !newGroup.trim() || !newEquipment || saving}
                    loading={saving}
                    onPress={handleCreate}
                  />
                </View>
              </ScrollView>
            ) : (
              <>
                <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                  <Feather name="search" size={16} color={colors.mutedForeground} />
                  <TextInput
                    accessibilityLabel="Поиск упражнения"
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
                    const hint = exerciseRankHint(ex, profile);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          onSelect(ex.id);
                          Keyboard.dismiss();
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
                        <View style={{ flex: 1, gap: 4 }}><Text
                          style={[
                            styles.exName,
                            { color: active ? colors.primary : colors.foreground },
                          ]}
                        >
                          {ex.name}
                        </Text>
                        {hint?.current ? <Text style={{ color: colors.success, fontSize: 12 }}>{hint.standard.official ? "Выполнен" : "Достигнут ориентир"}: {hint.current.rank.label}</Text> : null}
                        {hint ? <Text style={{ color: hint.atMaximum ? colors.success : colors.mutedForeground, fontSize: 12 }}>{hint.standard.official ? hint.rank.label : `Ориентир ${hint.rank.shortLabel}`}: {formatStandard(hint.target, hint.standard.unit)}{hint.atMaximum ? "" : ` · осталось ${formatStandard(hint.remaining, hint.standard.unit)}`}</Text> : null}
                        </View>
                        {active ? (
                          <Feather name="check" size={18} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  style={{ flexGrow: 0, flexShrink: 1, maxHeight: 380, minHeight: 80 }}
                  ListEmptyComponent={
                    <Text style={{ color: colors.mutedForeground, textAlign: "center", paddingVertical: 24 }}>
                      Ничего не найдено
                    </Text>
                  }
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                />

                {onCreate ? <Button
                  variant="secondary"
                  title="Создать своё"
                  icon={<Feather name="plus" size={16} color={colors.foreground} />}
                  onPress={() => setCreating(true)}
                  fullWidth
                  style={{ marginTop: 12 }}
                /> : null}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0,
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
    letterSpacing: 0,
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
    flexShrink: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: "90%",
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
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  groupHeader: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0,
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
    borderRadius: 8,
  },
  exName: { fontSize: 16, fontFamily: "Inter_500Medium" },
  inputWrap: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
  },
  input: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
