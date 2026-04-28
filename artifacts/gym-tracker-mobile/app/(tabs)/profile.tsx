import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  type BMICategory,
  getGetLevelForecastQueryKey,
  getGetLevelsQueryKey,
  getGetProfileQueryKey,
  useGetProfile,
  useUpdateProfile,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Stepper } from "@/components/Stepper";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";

type Sex = "male" | "female";

const BMI_LABEL: Record<BMICategory, string> = {
  underweight: "Недовес",
  normal: "Норма",
  overweight: "Избыток",
  obese: "Ожирение",
};

const DEFAULT_WEIGHT = 80;
const DEFAULT_HEIGHT = 178;
const DEFAULT_SEX: Sex = "male";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetProfile();

  const [weight, setWeight] = useState<number>(DEFAULT_WEIGHT);
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [sex, setSex] = useState<Sex>(DEFAULT_SEX);

  useEffect(() => {
    if (!data) return;
    setWeight(data.bodyWeightKg ?? DEFAULT_WEIGHT);
    setHeight(data.heightCm ?? DEFAULT_HEIGHT);
    setSex((data.sex as Sex) ?? DEFAULT_SEX);
  }, [data]);

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: (next) => {
        queryClient.setQueryData(getGetProfileQueryKey(), next);
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelForecastQueryKey() });
      },
    },
  });

  const hasChanges = useMemo(() => {
    if (!data) return false;
    const currentWeight = data.bodyWeightKg ?? DEFAULT_WEIGHT;
    const currentHeight = data.heightCm ?? DEFAULT_HEIGHT;
    const currentSex = (data.sex as Sex) ?? DEFAULT_SEX;
    return currentWeight !== weight || currentHeight !== height || currentSex !== sex;
  }, [data, height, sex, weight]);

  if (isLoading || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
    >
      <Pressable onPress={() => router.push("/levels")} style={styles.backRow}>
        <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>Уровни</Text>
      </Pressable>

      <View style={{ gap: 6 }}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Профиль</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Вес, рост и пол нужны для точных нормативов и упражнений с собственным весом.</Text>
      </View>

      <Card padding={14}>
        <View style={styles.metricsRow}>
          <MetricChip label="Вес" value={`${formatNumber(data.bodyWeightKg ?? 0)} кг`} colors={colors} />
          <MetricChip label="Рост" value={`${formatNumber(data.heightCm ?? 0)} см`} colors={colors} />
          <MetricChip label="Пол" value={sex === "female" ? "Женщина" : "Мужчина"} colors={colors} />
        </View>
        {data.bmi && data.bmiCategory ? (
          <Text style={[styles.bmi, { color: colors.primary }]}>BMI {data.bmi} · {BMI_LABEL[data.bmiCategory]}</Text>
        ) : null}
      </Card>

      <Card padding={14} style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Пол</Text>
          <View style={styles.sexRow}>
            {(["male", "female"] as Sex[]).map((value) => {
              const active = sex === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setSex(value)}
                  style={({ pressed }) => [
                    styles.sexButton,
                    {
                      borderColor: active ? colors.primary : colors.cardBorder,
                      backgroundColor: active ? colors.primarySoft : colors.muted,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.primary : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 14,
                    }}
                  >
                    {value === "female" ? "Женщина" : "Мужчина"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Stepper
          label="Вес тела"
          value={weight}
          onChange={setWeight}
          min={30}
          max={250}
          chips={[60, 70, 80, 90, 100]}
          unit="кг"
        />

        <Stepper
          label="Рост (для BMI)"
          value={height}
          onChange={setHeight}
          min={100}
          max={230}
          chips={[160, 170, 180, 190]}
          unit="см"
        />

        <Button
          title={updateProfile.isPending ? "Сохраняю..." : "Сохранить"}
          onPress={() => updateProfile.mutate({ data: { bodyWeightKg: weight, heightCm: height, sex } })}
          disabled={!hasChanges || updateProfile.isPending}
        />

        {updateProfile.isError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>Не получилось сохранить. Попробуй еще раз.</Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function MetricChip({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.metric, { borderColor: colors.cardBorder, backgroundColor: colors.muted }]}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 6 },
  backText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sub: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium" },
  metricsRow: { flexDirection: "row", gap: 8 },
  metric: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  metricLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  metricValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bmi: { marginTop: 12, fontSize: 13, fontFamily: "Inter_700Bold" },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sexRow: { flexDirection: "row", gap: 8 },
  sexButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
