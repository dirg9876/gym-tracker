import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWorkoutQueryKey,
  useGetWorkout,
  type WorkoutReport as WorkoutReportType,
} from "@workspace/api-client-react";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { AiCoachPanel } from "@/components/AiCoachPanel";
import { WorkoutAnalysis } from "@/components/WorkoutAnalysis";
import { Card } from "@/components/Card";
import { PRBadge } from "@/components/PRBadge";
import { SaveWorkoutTemplate } from "@/components/SaveWorkoutTemplate";
import { AutomaticWorkoutBackup } from "@/components/AutomaticWorkoutBackup";
import { useColors } from "@/hooks/useColors";
import { returnToBrand } from "@/lib/navigation";
import { formatDuration, formatKg, formatNumber } from "@/lib/format";
import { durationOf, formatSeconds, isTimedExercise } from "@/lib/workoutMeasurement";

export default function WorkoutReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = parseInt(params.id || "0", 10);

  const report = queryClient.getQueryData([
    "finish-report",
    workoutId,
  ]) as WorkoutReportType | undefined;

  const { data: workout, isLoading } = useGetWorkout(workoutId, {
    query: { enabled: !report && !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId) },
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

  if (!report && !workout) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.foreground }}>Отчет не найден</Text>
      </View>
    );
  }

  const w = report?.workout || workout!;
  const hasPRs =
    report && (report.newPersonalRecords.length > 0 || report.newExerciseRecords.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {w.finishedAt ? <AutomaticWorkoutBackup /> : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 24,
        }}
      >
        {/* Hero */}
        <View style={{ alignItems: "center", gap: 14 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.successSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name={hasPRs ? "award" : "check-circle"} size={48} color={colors.success} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 26, fontFamily: "Inter_700Bold" }}>
            Тренировка завершена!
          </Text>
        </View>

        <SaveWorkoutTemplate workout={w} />
        <WorkoutAnalysis workoutId={w.id} />
        <AiCoachPanel task="review" workoutId={w.id} />
        <AiCoachPanel task="next_workout" workoutId={w.id} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            { l: "Тоннаж", v: formatKg(w.totalVolume) },
            { l: "Время записи", v: report ? formatDuration(report.durationMinutes) : "—" },
            { l: "Повторы", v: formatNumber(w.totalReps) },
            { l: "Подходы", v: String(w.totalSets) },
            ...(durationOf(w) > 0 ? [{ l: "Удержания", v: formatSeconds(durationOf(w)) }] : []),
          ].map((s) => (
            <Card key={s.l} style={{ width: "48%" }} padding={14}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6, textTransform: "uppercase" }}>
                {s.l}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 }}>
                {s.v}
              </Text>
            </Card>
          ))}
        </View>

        {report && report.newPersonalRecords.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 4 }}>
              Новые рекорды
            </Text>
            {report.newPersonalRecords.map((pr, i) => (
              <PRBadge
                key={`${pr.kind}-${i}`}
                kind={pr.kind}
                value={pr.value}
                delta={pr.delta}
                formatFn={pr.kind === "reps" ? formatNumber : formatKg}
              />
            ))}
          </View>
        ) : null}

        {report && report.newExerciseRecords.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 4 }}>
              Рекорды в упражнениях
            </Text>
            {report.newExerciseRecords.map((er, i) => (
              <PRBadge
                key={`${er.exerciseId}-${er.kind}-${i}`}
                kind={er.kind}
                value={er.value}
                delta={er.value - er.previous}
                formatFn={er.kind === "max_reps" ? formatNumber : formatKg}
                exerciseName={er.exerciseName}
              />
            ))}
          </View>
        ) : null}

        {report && report.exerciseBreakdown.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold", paddingHorizontal: 4 }}>
              Сводка
            </Text>
            <Card padding={0}>
              {report.exerciseBreakdown.map((ex, i) => (
                <View
                  key={ex.exerciseId}
                  style={{
                    padding: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.cardBorder,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>
                    {ex.exerciseName}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      {ex.sets} подх.{isTimedExercise(ex.exerciseName) ? "" : ` / ${ex.reps} повт.`}
                    </Text>
                    <Text style={{ color: colors.foreground, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                      {isTimedExercise(ex.exerciseName) ? formatSeconds(durationOf(ex)) : formatKg(ex.volume)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
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
          title="К Gym-Beam"
          onPress={returnToBrand}
          icon={<Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
