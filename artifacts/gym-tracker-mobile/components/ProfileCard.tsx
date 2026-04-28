import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLevelForecastQueryKey,
  getGetLevelsQueryKey,
  getGetProfileQueryKey,
  type BMICategory,
  type Profile,
  useGetProfile,
  useUpdateProfile,
} from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Stepper } from "@/components/Stepper";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";

type Sex = "male" | "female";

const DEFAULT_WEIGHT = 80;
const DEFAULT_HEIGHT = 178;
const DEFAULT_SEX: Sex = "male";

const SEX_LABEL: Record<Sex, string> = {
  male: "Мужчина",
  female: "Женщина",
};

const BMI_LABEL: Record<BMICategory, string> = {
  underweight: "Недовес",
  normal: "Норма",
  overweight: "Избыток",
  obese: "Ожирение",
};

export function ProfileCard() {
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetProfile();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(DEFAULT_WEIGHT);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [sex, setSex] = useState<Sex>(DEFAULT_SEX);

  useEffect(() => {
    if (data && !editing) {
      setWeight(data.bodyWeightKg ?? DEFAULT_WEIGHT);
      setHeight(data.heightCm ?? DEFAULT_HEIGHT);
      setSex((data.sex as Sex) ?? DEFAULT_SEX);
    }
  }, [data, editing]);

  const update = useUpdateProfile({
    mutation: {
      onSuccess: (next: Profile) => {
        queryClient.setQueryData(getGetProfileQueryKey(), next);
        queryClient.invalidateQueries({ queryKey: getGetLevelsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLevelForecastQueryKey() });
        setEditing(false);
        toast.show("success", "Профиль сохранен");
      },
      onError: () => toast.show("error", "Не получилось сохранить профиль"),
    },
  });

  if (isLoading || !data) {
    return (
      <Card padding={16} style={{ minHeight: 84, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }

  const hasWeight = data.bodyWeightKg != null;
  const hasHeight = data.heightCm != null;

  if (!hasWeight && !editing) {
    return (
      <Card onPress={() => setEditing(true)} padding={16} style={{ borderColor: colors.amber }}>
        <View style={styles.promptRow}>
          <Feather name="alert-triangle" size={22} color={colors.amber} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.promptTitle, { color: colors.foreground }]}>Укажи свой вес</Text>
            <Text style={[styles.promptText, { color: colors.mutedForeground }]}>
              Вес и пол влияют на нормативы, уровни и тоннах для упражнений со своим весом.
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card padding={16}>
        <View style={{ gap: 16 }}>
          <View style={styles.headerRow}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Твой профиль
            </Text>
            <Pressable
              onPress={() => setEditing(false)}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Пол</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["male", "female"] as Sex[]).map((item) => {
                const active = sex === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setSex(item)}
                    style={({ pressed }) => [
                      styles.sexButton,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.cardBorder,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                      numberOfLines={1}
                      style={[
                        styles.sexButtonText,
                        { color: active ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {SEX_LABEL[item]}
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
            step={1}
            chips={[60, 70, 80, 90, 100]}
            unit="кг"
          />
          <Stepper
            label="Рост для BMI"
            value={height}
            onChange={setHeight}
            min={100}
            max={230}
            step={1}
            chips={[160, 170, 180, 190]}
            unit="см"
          />
          <Button
            title={update.isPending ? "Сохраняю..." : "Сохранить"}
            fullWidth
            loading={update.isPending}
            icon={<Feather name="check" size={18} color={colors.primaryForeground} />}
            onPress={() =>
              update.mutate({ data: { bodyWeightKg: weight, heightCm: height, sex } })
            }
          />
        </View>
      </Card>
    );
  }

  return (
    <Card onPress={() => setEditing(true)} padding={14}>
      <View style={styles.displayRow}>
        <Metric icon="activity" value={`${formatNumber(data.bodyWeightKg ?? 0)} кг`} />
        {hasHeight ? <Metric icon="maximize-2" value={`${formatNumber(data.heightCm ?? 0)} см`} /> : null}
        <View style={styles.personRow}>
          <Feather name="user" size={14} color={colors.mutedForeground} />
          <Text
            numberOfLines={1}
            style={[styles.personText, { color: colors.mutedForeground }]}
          >
            {SEX_LABEL[(data.sex as Sex) ?? "male"]}
          </Text>
        </View>
        {data.bmi !== null && data.bmiCategory ? (
          <View style={[styles.bmiPill, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              numberOfLines={1}
              style={[styles.bmiText, { color: colors.primary }]}
            >
              BMI {data.bmi} · {BMI_LABEL[data.bmiCategory]}
            </Text>
          </View>
        ) : null}
        {!hasHeight ? (
          <Text style={[styles.addHeight, { color: colors.mutedForeground }]}>+ рост для BMI</Text>
        ) : null}
        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
      </View>
    </Card>
  );
}

function Metric({ icon, value }: { icon: React.ComponentProps<typeof Feather>["name"]; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.metric}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promptTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  promptText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sexButton: {
    flex: 1,
    minWidth: 0,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  sexButtonText: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  displayRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
  },
  metric: { flexDirection: "row", alignItems: "center", gap: 4 },
  metricValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  personText: { fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: 92 },
  bmiPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "100%",
  },
  bmiText: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  addHeight: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
