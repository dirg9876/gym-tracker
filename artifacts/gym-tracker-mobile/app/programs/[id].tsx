import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetActiveWorkoutQueryKey,
  getGetProgramPlanQueryKey,
  useCreateWorkout,
  useGetActiveWorkout,
  useGetProgramPlan,
} from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { savePlan } from "@/lib/programPlanStash";

const intentLabel: Record<string, string> = {
  strength: "Сила",
  hypertrophy: "Масса",
  accessory: "Добивка",
};

export default function ProgramDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const programId = params.id ?? "";

  const { data: plan, isLoading, isError } = useGetProgramPlan(programId, {
    query: {
      queryKey: getGetProgramPlanQueryKey(programId),
      enabled: Boolean(programId),
    },
  });

  const { data: activeWorkoutResponse } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: async (newWorkout) => {
        if (plan) {
          await savePlan(newWorkout.id, plan);
        }
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        router.replace(`/workout/${newWorkout.id}`);
      },
    },
  });

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !plan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Программа не найдена" onBack={() => router.replace("/programs")} />
      </View>
    );
  }

  const handleStart = () => {
    if (activeWorkout) {
      router.replace(`/workout/${activeWorkout.id}`);
      return;
    }
    createWorkout.mutate({ data: { name: plan.name } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={plan.name} onBack={() => router.replace("/programs")} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 110,
          gap: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.muted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 30 }}>{plan.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold" }}>
              {plan.name}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
              {plan.description}
            </Text>
          </View>
        </View>

        <Card padding={12}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
              LVL {plan.basedOnLevel}
            </Text>{" "}
            <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
              {plan.basedOnLevelName}
            </Text>{" "}
            · веса подобраны под твой уровень.
          </Text>
        </Card>

        <View style={{ gap: 10 }}>
          {plan.exercises.map((ex, idx) => {
            const reps =
              ex.repsMin === ex.repsMax ? `${ex.repsMin}` : `${ex.repsMin}–${ex.repsMax}`;
            const weight = ex.isBodyweight
              ? "Свой вес"
              : ex.suggestedWeightKg > 0
                ? `${ex.suggestedWeightKg} кг`
                : "—";
            return (
              <Card key={`${ex.exerciseId}-${idx}`} padding={14}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 10,
                        fontFamily: "Inter_700Bold",
                        letterSpacing: 0.6,
                      }}
                    >
                      #{idx + 1} · {ex.muscleGroup}
                    </Text>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 15,
                        fontFamily: "Inter_700Bold",
                        marginTop: 2,
                      }}
                    >
                      {ex.name}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: colors.primarySoft,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.primaryRing,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 9,
                        fontFamily: "Inter_700Bold",
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                      }}
                    >
                      {intentLabel[ex.intent] ?? "Добивка"}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  {[
                    { l: "Подходы", v: String(ex.sets) },
                    { l: "Повторы", v: reps },
                    { l: "Вес", v: weight },
                  ].map((s) => (
                    <View key={s.l} style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 9,
                          fontFamily: "Inter_700Bold",
                          letterSpacing: 0.6,
                          textTransform: "uppercase",
                        }}
                      >
                        {s.l}
                      </Text>
                      <Text
                        style={{
                          color: colors.foreground,
                          fontSize: 18,
                          fontFamily: "Inter_700Bold",
                          marginTop: 2,
                        }}
                      >
                        {s.v}
                      </Text>
                    </View>
                  ))}
                </View>

                {ex.note ? (
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 11,
                      fontStyle: "italic",
                      marginTop: 8,
                    }}
                  >
                    {ex.note}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.cardBorder,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <Button
          size="lg"
          fullWidth
          onPress={handleStart}
          loading={createWorkout.isPending}
          icon={
            <Feather
              name={activeWorkout ? "activity" : "zap"}
              size={18}
              color={colors.primaryForeground}
            />
          }
          title={activeWorkout ? "Открыть текущую тренировку" : `Начать «${plan.name}»`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
