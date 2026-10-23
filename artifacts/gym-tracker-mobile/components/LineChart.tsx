import React, { useId, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { formatNumber, formatShortDate } from "@/lib/format";
import { lineChartGeometry } from "@/lib/chartGeometry";

type Props = {
  points: { date: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  label?: string;
  zeroBaseline?: boolean;
  forecastStartIndex?: number;
  forecastColor?: string;
  formatPoint?: (index: number) => string;
  minimumSpan?: number;
};

export function LineChart({ points, color, height = 160, formatValue = formatNumber, selectedIndex, onSelect, label = "Динамика", zeroBaseline = true, forecastStartIndex = -1, forecastColor, formatPoint, minimumSpan }: Props) {
  const colors = useColors();
  const stroke = color ?? colors.primary;
  const [width, setWidth] = useState(0);
  const gradient = `area-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const geometry = lineChartGeometry(points, width, height, zeroBaseline, minimumSpan);
  const index = selectedIndex != null && selectedIndex >= 0 && selectedIndex < points.length ? selectedIndex : points.length - 1;
  const selected = points[index];
  const valid = points.length > 0 && points.every(point => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.date)));
  if (!valid) return <View style={{ height: height + 62, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.mutedForeground }}>Нет данных</Text></View>;
  const hasForecast = forecastStartIndex >= 0 && forecastStartIndex < points.length;
  const projectedStroke = forecastColor ?? colors.success;
  const measured = geometry?.coordinates.slice(0, hasForecast ? forecastStartIndex : points.length) ?? [];
  const projected = hasForecast ? geometry?.coordinates.slice(Math.max(0, forecastStartIndex - 1)) ?? [] : [];
  const path = (coordinates: typeof measured) => coordinates.map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const line = path(measured);
  const area = geometry && measured.length ? `${line} L ${measured.at(-1)!.x} ${geometry.bottom} L ${measured[0].x} ${geometry.bottom} Z` : "";
  const selectedColor = hasForecast && index >= forecastStartIndex ? projectedStroke : stroke;
  const selectedText = formatPoint?.(index) ?? formatValue(selected.value);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={{ minHeight: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatShortDate(selected.date)}</Text>
      <Text style={{ color: selectedColor, fontSize: 20, flexShrink: 1, textAlign: "right", fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{selectedText}</Text>
    </View>
    <View accessible accessibilityRole={onSelect ? "adjustable" : "image"} accessibilityLabel={label}
      accessibilityValue={{ text: `${hasForecast && index >= forecastStartIndex ? "Условный прогноз" : "Факт"}, ${formatShortDate(selected.date)}: ${selectedText}` }}
      accessibilityActions={onSelect ? [{ name: "increment", label: "Следующая тренировка" }, { name: "decrement", label: "Предыдущая тренировка" }] : undefined}
      onAccessibilityAction={event => onSelect?.(Math.max(0, Math.min(points.length - 1, index + (event.nativeEvent.actionName === "increment" ? 1 : -1))))}>
      {geometry ? <Svg width={width} height={height} onPress={onSelect ? event => {
        const x = event.nativeEvent.locationX;
        let nearest = 0;
        for (let i = 1; i < geometry.coordinates.length; i++) if (Math.abs(geometry.coordinates[i].x - x) < Math.abs(geometry.coordinates[nearest].x - x)) nearest = i;
        onSelect(nearest);
      } : undefined}>
        <Defs><LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={stroke} stopOpacity={0.2} /><Stop offset="1" stopColor={stroke} stopOpacity={0} /></LinearGradient></Defs>
        {geometry.ticks.map((tick, i) => <React.Fragment key={i}>
          <Line x1={geometry.left} x2={geometry.right} y1={tick.y} y2={tick.y} stroke={colors.cardBorder} strokeDasharray="3 5" />
          <SvgText x={geometry.left - 8} y={tick.y + 4} textAnchor="end" fontSize={10} fill={colors.mutedForeground}>{formatNumber(tick.value)}</SvgText>
        </React.Fragment>)}
        {measured.length > 1 ? <Path d={area} fill={`url(#${gradient})`} /> : null}
        {line ? <Path d={line} stroke={stroke} strokeWidth={2.5} fill="none" /> : null}
        {projected.length ? <Path d={path(projected)} stroke={projectedStroke} strokeWidth={2.5} strokeDasharray="6 5" fill="none" /> : null}
        {geometry.coordinates.map((point, i) => {
          const forecast = hasForecast && i >= forecastStartIndex, pointColor = forecast ? projectedStroke : stroke;
          return points.length <= 160 || i === index || i === 0 || i === forecastStartIndex - 1 || forecast
            ? <Circle key={i} cx={point.x} cy={point.y} r={i === index ? 5 : 3} fill={i === index || !forecast ? pointColor : colors.background} stroke={pointColor} strokeWidth={2} /> : null;
        })}
      </Svg> : <View style={{ height }} />}
    </View>
    <View style={{ minHeight: 22, flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{formatShortDate(points[0].date)}</Text>
      {points.length > 1 ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{formatShortDate(points.at(-1)!.date)}</Text> : null}
    </View>
  </View>;
}
