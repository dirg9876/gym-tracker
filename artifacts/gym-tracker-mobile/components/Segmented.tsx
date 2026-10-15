import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function Segmented<T extends string>({ label, value, options, onChange, disabled = false, numeric = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean; numeric?: boolean }) {
  const colors = useColors();
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{label}</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={`${label}: ${option.label}`} accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)} style={{ flexGrow: 1, flexBasis: numeric ? option.value === "unknown" ? "100%" : 40 : 56, minHeight: 44, padding: 8, justifyContent: "center", alignItems: "center", borderRadius: 6, backgroundColor: value === option.value ? colors.primarySoft : colors.muted, borderWidth: 1, borderColor: value === option.value ? colors.primary : colors.cardBorder, opacity: disabled ? 0.5 : 1 }}>
        <Text style={{ color: value === option.value ? colors.primary : colors.foreground, fontSize: 12, textAlign: "center" }}>{option.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
