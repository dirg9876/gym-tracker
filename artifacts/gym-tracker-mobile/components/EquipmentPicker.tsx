import Feather from "@expo/vector-icons/Feather";
import type { Equipment } from "@workspace/api-client-react";
import { useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const options: { value: Equipment; label: string }[] = [
  { value: "barbell", label: "Штанга" }, { value: "dumbbell", label: "Гантели" },
  { value: "bodyweight", label: "Собственный вес" }, { value: "machine", label: "Тренажёры" },
  { value: "other", label: "Другое" },
];
export function EquipmentPicker({ value, onChange, disabled }: { value: Equipment | null; onChange: (value: Equipment) => void; disabled?: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const label = options.find(option => option.value === value)?.label;
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Категория: ${label ?? "выбрать"}`} accessibilityState={{ expanded, disabled: !!disabled }} disabled={disabled} onPress={() => { Keyboard.dismiss(); setExpanded(current => !current); }} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, backgroundColor: colors.muted }}>
      <Text style={{ flex: 1, color: label ? colors.foreground : colors.mutedForeground, fontSize: 15 }}>{label ?? "Выбрать категорию"}</Text>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
    </Pressable>
    {expanded ? <View accessibilityRole="radiogroup" style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 6, overflow: "hidden" }}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`Категория упражнения: ${option.label}`} accessibilityState={{ checked: value === option.value, disabled: !!disabled }} disabled={disabled} onPress={() => { onChange(option.value); setExpanded(false); }} style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: value === option.value ? colors.primarySoft : colors.background }}>
        <Text style={{ flex: 1, color: colors.foreground, fontSize: 15 }}>{option.label}</Text>
        {value === option.value ? <Feather name="check" size={18} color={colors.primary} /> : null}
      </Pressable>)}
    </View> : null}
  </View>;
}
