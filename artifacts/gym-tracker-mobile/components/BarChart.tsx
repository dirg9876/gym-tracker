import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

type Bar = { label: string; value: number };

type Props = {
  bars: Bar[];
  height?: number;
  color?: string;
};

export function BarChart({ bars, height = 220, color }: Props) {
  const colors = useColors();
  const fill = color ?? colors.primary;

  if (bars.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground }}>Нет данных</Text>
      </View>
    );
  }

  const max = Math.max(...bars.map(bar => bar.value), 1);

  return (
    <View style={{ gap: 16 }}>
      {bars.map((bar, index) => (
        <View key={`${bar.label}-${index}`} accessible accessibilityLabel={`${bar.label}: ${formatKg(bar.value)}`} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{bar.label}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium", flexShrink: 1 }}>{formatKg(bar.value)}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.muted }}>
            <View style={{ height: 8, width: `${Math.max(0, Math.min(100, bar.value / max * 100))}%`, backgroundColor: fill }} />
          </View>
        </View>
      ))}
    </View>
  );
}
