import React from "react";
import { Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

type Bar = { label: string; value: number; detail?: string; color?: string };

type Props = {
  bars: Bar[];
  height?: number;
  color?: string;
  formatValue?: (value: number) => string;
};

export function BarChart({ bars, height = 220, color, formatValue = formatKg }: Props) {
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
        <View key={`${bar.label}-${index}`} accessible accessibilityLabel={`${bar.label}: ${formatValue(bar.value)}${bar.detail ? `, ${bar.detail}` : ""}`} style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>{bar.label}</Text>
            <Text style={{ color: bar.color ?? fill, fontSize: 14, fontFamily: "Inter_600SemiBold", flexShrink: 1, fontVariant: ["tabular-nums"] }}>{formatValue(bar.value)}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.muted }}>
            <View style={{ height: 8, width: `${Math.max(0, Math.min(100, bar.value / max * 100))}%`, backgroundColor: bar.color ?? fill }} />
          </View>
          {bar.detail ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{bar.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}
