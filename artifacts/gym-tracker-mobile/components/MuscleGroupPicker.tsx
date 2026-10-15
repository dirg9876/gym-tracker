import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const STANDARD_GROUPS = ["Грудь", "Спина", "Ноги", "Икры", "Плечи", "Бицепс", "Трицепс", "Пресс"];
type Props = { value: string; onChange: (value: string) => void; groups?: string[]; disabled?: boolean };
export function MuscleGroupPicker({ value, onChange, groups = [], disabled }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [custom, setCustom] = useState(false);
  const options = [...new Set([...STANDARD_GROUPS, ...groups, ...(!custom && value ? [value] : [])])].filter(Boolean).sort((a, b) => a.localeCompare(b, "ru"));
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Группа мышц: ${value || "выбрать"}`} accessibilityState={{ expanded, disabled: !!disabled }} disabled={disabled} onPress={() => { Keyboard.dismiss(); setExpanded(previous => !previous); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.muted }}>
      <Text style={{ flex: 1, color: value ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>{value || "Выбрать группу мышц"}</Text>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
    </Pressable>
    {expanded ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 224, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6 }}>
      {options.map(group => <Pressable key={group} accessibilityRole="radio" accessibilityLabel={`Выбрать группу: ${group}`} accessibilityState={{ checked: value === group }} disabled={disabled} onPress={() => { onChange(group); setCustom(false); setExpanded(false); }} style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: value === group ? colors.primarySoft : colors.background }}>
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 15 }}>{group}</Text>
        {value === group ? <Feather name="check" size={18} color={colors.primary} /> : null}
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Своя группа мышц" disabled={disabled} onPress={() => { setExpanded(false); setCustom(true); onChange(""); }} style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}><Feather name="plus" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 15 }}>Своя группа</Text></Pressable>
    </ScrollView> : null}
    {custom && !expanded ? <TextInput autoFocus accessibilityLabel="Новая группа мышц" placeholder="Название группы" placeholderTextColor={colors.mutedForeground} value={value} onChangeText={onChange} maxLength={60} editable={!disabled} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} style={{ minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, color: colors.foreground, fontSize: 15 }} /> : null}
  </View>;
}
