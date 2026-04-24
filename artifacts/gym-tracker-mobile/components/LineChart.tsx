import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

type Point = { date: string; value: number };

type Props = {
  points: Point[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
};

export function LineChart({ points, color, height = 160, formatValue }: Props) {
  const colors = useColors();
  const stroke = color ?? colors.primary;
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  if (points.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.mutedForeground }}>Нет данных</Text>
      </View>
    );
  }

  const padX = 8;
  const padY = 12;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const xFor = (i: number) =>
    padX + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const yFor = (v: number) => padY + h - ((v - min) / span) * h;

  const linePath =
    width > 0
      ? points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`)
          .join(" ")
      : "";
  const areaPath =
    width > 0
      ? `${linePath} L ${xFor(points.length - 1)} ${padY + h} L ${xFor(0)} ${padY + h} Z`
      : "";

  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {points.length} {points.length === 1 ? "точка" : "точек"}
        </Text>
        <Text style={[styles.lastValue, { color: stroke }]}>
          {formatValue ? formatValue(last.value) : last.value}
        </Text>
      </View>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.35} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {points.length > 1 ? (
            <Path d={areaPath} fill="url(#grad)" />
          ) : null}
          <Path d={linePath} stroke={stroke} strokeWidth={2.5} fill="none" />
          {points.map((p, i) => (
            <Circle
              key={`${p.date}-${i}`}
              cx={xFor(i)}
              cy={yFor(p.value)}
              r={3.5}
              fill={colors.background}
              stroke={stroke}
              strokeWidth={2}
            />
          ))}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  lastValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
});
