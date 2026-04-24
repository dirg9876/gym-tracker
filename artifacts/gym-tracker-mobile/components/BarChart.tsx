import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

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
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (bars.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground }}>Нет данных</Text>
      </View>
    );
  }

  const max = Math.max(...bars.map((b) => b.value), 1);
  const labelW = 96;
  const rowH = 28;
  const gap = 6;
  const totalH = bars.length * (rowH + gap);

  return (
    <View onLayout={onLayout} style={{ minHeight: totalH }}>
      {width > 0 ? (
        <Svg width={width} height={totalH}>
          {bars.map((b, i) => {
            const y = i * (rowH + gap);
            const trackW = width - labelW - 8;
            const barW = (b.value / max) * trackW;
            return (
              <React.Fragment key={`${b.label}-${i}`}>
                <Rect
                  x={labelW}
                  y={y + 8}
                  width={trackW}
                  height={12}
                  rx={6}
                  ry={6}
                  fill={colors.muted}
                />
                <Rect
                  x={labelW}
                  y={y + 8}
                  width={Math.max(2, barW)}
                  height={12}
                  rx={6}
                  ry={6}
                  fill={fill}
                />
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}

      {/* Text labels overlaid */}
      <View style={[StyleSheet.absoluteFill, { gap }]}>
        {bars.map((b, i) => (
          <View key={`l-${b.label}-${i}`} style={[styles.row, { height: rowH }]}>
            <Text
              style={[styles.label, { color: colors.foreground, width: labelW - 8 }]}
              numberOfLines={1}
            >
              {b.label}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.value, { color: colors.mutedForeground }]}>
              {formatKg(b.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  value: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
