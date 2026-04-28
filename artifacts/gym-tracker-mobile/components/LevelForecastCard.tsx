import { Feather } from "@expo/vector-icons";
import { useGetLevelForecast } from "@workspace/api-client-react";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
  achieved: "максимум",
};

function formatDays(days: number): string {
  if (days <= 0) return "сегодня";
  if (days === 1) return "1 день";
  if (days < 5) return `${days} дня`;
  if (days < 30) return `${days} дней`;
  if (days < 60) return "около месяца";
  if (days < 365) return `~${Math.round(days / 30)} мес.`;
  return "более года";
}

export function LevelForecastCard() {
  const colors = useColors();
  const { data, isLoading } = useGetLevelForecast();

  if (isLoading) {
    return (
      <Card padding={16}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }
  if (!data) return null;

  if (data.confidence === "achieved" || data.nextLevel === null) {
    return (
      <Card padding={16}>
        <View style={styles.row}>
          <Feather name="zap" size={22} color="#34d399" />
          <Text style={[styles.body, { color: colors.foreground }]}>
            Достигнут максимум прогресса. Поддерживай тоннах и оставайся на вершине.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card padding={16}>
      <View style={{ gap: 12 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text
              style={[styles.label, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              Прогноз до «{data.nextLevelName}»
            </Text>
          </View>
          <Text style={[styles.confidence, { color: colors.primary }]}>
            {CONFIDENCE_LABEL[data.confidence]}
          </Text>
        </View>

        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[styles.days, { color: colors.primary }]}
        >
          {data.estimatedDays == null ? "—" : formatDays(data.estimatedDays)}
        </Text>

        <Metric label="Темп за день" value={`${formatNumber(data.avgDailyTonnageKg)} кг`} />
        <Metric label="За последние 7 дней" value={`${formatNumber(data.tonnage7dKg)} кг`} />
        <Metric label="Осталось в окне 7 дней" value={`${formatNumber(data.tonnageNeededKg)} кг`} />

        {data.estimatedDays === null && data.avgDailyTonnageKg <= 0 ? (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            Пока нет данных за последние 7 дней. Проведи тренировку, чтобы увидеть прогноз.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  body: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  label: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  confidence: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  days: { fontSize: 30, fontFamily: "Inter_700Bold" },
  metric: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  metricLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  metricValue: { fontSize: 12, fontFamily: "Inter_700Bold" },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
