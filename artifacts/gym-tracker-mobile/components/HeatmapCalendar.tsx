import { Feather } from "@expo/vector-icons";
import { type HeatmapDay, useGetHeatmap } from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";

const CELL = 12;
const GAP = 3;
const COLORS = ["#333333", "#7f1d1d", "#c2410c", "#f97316", "#fb923c"];
const MONTH_NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function HeatmapCalendar() {
  const colors = useColors();
  const { data, isLoading } = useGetHeatmap({ days: 365 });
  const [selected, setSelected] = useState<HeatmapDay | null>(null);

  const grid = useMemo(() => {
    if (!data || data.days.length === 0) return null;
    const first = parseLocalDate(data.days[0]!.date);
    const dow = (first.getDay() + 6) % 7;
    const padded: (HeatmapDay | null)[] = [];
    for (let i = 0; i < dow; i += 1) padded.push(null);
    for (const day of data.days) padded.push(day);
    while (padded.length % 7 !== 0) padded.push(null);

    const cols: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  }, [data]);

  const monthLabels = useMemo(() => {
    if (!grid) return [];
    const labels: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;
    grid.forEach((col, index) => {
      const firstDay = col.find((item) => item !== null);
      if (!firstDay) return;
      const month = parseLocalDate(firstDay.date).getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        labels.push({ index, label: MONTH_NAMES[month]! });
      }
    });
    return labels;
  }, [grid]);

  if (isLoading || !data || !grid) return null;

  return (
    <Card padding={16}>
      <View style={{ gap: 12 }}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Активность за год</Text>
          </View>
          <Text style={[styles.days, { color: colors.mutedForeground }]}>
            {data.activeDays} / {data.totalDays} дн.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ paddingBottom: 4 }}>
            <View style={{ height: 14, position: "relative", marginLeft: 22 }}>
              {monthLabels.map((month) => (
                <Text
                  key={`${month.index}-${month.label}`}
                  style={[
                    styles.month,
                    {
                      color: colors.mutedForeground,
                      position: "absolute",
                      left: month.index * (CELL + GAP),
                    },
                  ]}
                >
                  {month.label}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={styles.weekLabels}>
                {["Пн", "", "Ср", "", "Пт", "", "Вс"].map((day, index) => (
                  <Text key={`${day}-${index}`} style={[styles.weekDay, { color: colors.mutedForeground }]}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: GAP }}>
                {grid.map((col, colIndex) => (
                  <View key={colIndex} style={{ gap: GAP }}>
                    {col.map((cell, rowIndex) => {
                      if (!cell) return <View key={`${colIndex}-${rowIndex}`} style={styles.cell} />;
                      return (
                        <Pressable
                          key={cell.date}
                          onPress={() => setSelected(cell)}
                          style={[
                            styles.cell,
                            {
                              backgroundColor: COLORS[cell.intensity] ?? COLORS[0],
                              borderColor: selected?.date === cell.date ? colors.foreground : "transparent",
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.legend}>
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Меньше</Text>
            {COLORS.map((color) => (
              <View key={color} style={[styles.legendCell, { backgroundColor: color }]} />
            ))}
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Больше</Text>
          </View>
          <Text style={[styles.selected, { color: colors.mutedForeground }]} numberOfLines={2}>
            {selected
              ? `${new Date(selected.date).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}: ${formatKg(selected.volume)} · ${selected.sets} подх.`
              : ""}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  days: { fontSize: 12, fontFamily: "Inter_500Medium" },
  month: { fontSize: 9, fontFamily: "Inter_500Medium" },
  weekLabels: { width: 18, gap: GAP, marginRight: 4 },
  weekDay: { width: 18, height: CELL, fontSize: 8, fontFamily: "Inter_500Medium" },
  cell: { width: CELL, height: CELL, borderRadius: 3, borderWidth: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  legend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  selected: { flex: 1, textAlign: "right", fontSize: 11, fontFamily: "Inter_400Regular" },
});
