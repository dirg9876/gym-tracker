import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { AiCoachPanel } from "@/components/AiCoachPanel";
import { WorkoutAnalysis } from "@/components/WorkoutAnalysis";
import { WorkoutCelebration } from "@/components/WorkoutCelebration";
import { SaveWorkoutTemplate } from "@/components/SaveWorkoutTemplate";
import { AutomaticWorkoutBackup } from "@/components/AutomaticWorkoutBackup";
import { useAiConnection } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { returnToBrand } from "@/lib/navigation";
import { formatDate, formatDuration, formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { durationOf, formatSeconds, formatSetResult, formatSetContext } from "@/lib/workoutMeasurement";
import type { WorkoutRecap } from "@/lib/workoutRecap";

export default function WorkoutReportScreen() {
  const colors = useColors(), insets = useSafeAreaInsets(), router = useRouter();
  const params = useLocalSearchParams<{ id: string; celebrate?: string }>(), id = Number(params.id);
  const validId = Number.isSafeInteger(id) && id > 0;
  const [details, setDetails] = useState(false), [ai, setAi] = useState(false);
  const connection = useAiConnection();
  const recap = useQuery({ queryKey: ["workout-recap", id], queryFn: () => coachRequest<WorkoutRecap>(`/api/workouts/${id}/recap`), enabled: validId, refetchOnMount: "always", retry: false });
  useFocusEffect(useCallback(() => { if (Number.isSafeInteger(id) && id > 0) void recap.refetch(); }, [id, recap.refetch]));
  const title = { color: colors.foreground, fontSize: 17, lineHeight: 24, fontFamily: "Inter_700Bold" };
  const muted = { color: colors.mutedForeground, fontSize: 12, lineHeight: 18 };
  const section = { gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: colors.cardBorder };
  if ((recap.error as { status?: number } | null)?.status === 409) return <Redirect href={`/workout/${id}`} />;
  if (!recap.data || (recap.error as { status?: number } | null)?.status === 404) return <View style={{ flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: insets.top + 24, gap: 20, justifyContent: "center" }}>{recap.isPending && !recap.isError && validId ? <ActivityIndicator color={colors.primary} /> : <><Text style={title}>Не удалось открыть итог</Text><Text style={muted}>Записи не изменены. Повторите загрузку или откройте историю.</Text><Button title="Повторить загрузку" icon={<Feather name="refresh-cw" size={18} color={colors.primaryForeground} />} disabled={!validId} onPress={() => { void recap.refetch(); }} /><Button title="На главную" variant="secondary" onPress={returnToBrand} /></>}</View>;
  const data = recap.data, w = data.workout, seconds = durationOf(w);
  return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 12, paddingBottom: 24, gap: 20 }}>
      <View style={{ gap: 8 }}>
        {w.totalSets > 0 ? <WorkoutCelebration workoutId={w.id} finishedAt={w.finishedAt!} fresh={params.celebrate === "1"} /> : null}
        <Text accessibilityRole="header" style={{ color: colors.success, fontSize: 24, lineHeight: 30, textAlign: "center", fontFamily: "Inter_700Bold" }}>{w.totalSets ? "Тренировка завершена" : "Тренировка без подходов"}</Text>
        <Text style={{ ...muted, textAlign: "center" }}>{w.name || "Самостоятельная тренировка"} · {formatDate(w.startedAt)}</Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, alignItems: "center" }}><Feather name="check-circle" size={15} color={colors.success} /><Text style={{ ...muted, color: colors.success }}>Сохранено на устройстве</Text></View>
      </View>
      {recap.isError ? <Button title="Обновить итог" variant="secondary" icon={<Feather name="refresh-cw" size={17} color={colors.foreground} />} onPress={() => { void recap.refetch(); }} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {[{ label: "Подходов", value: String(w.totalSets) }, { label: "Упражнений", value: String(data.exercises.length) }, ...(data.repetitions > 0 ? [{ label: "Повторений", value: formatNumber(data.repetitions) }] : []), ...(seconds ? [{ label: "Удержания", value: formatSeconds(seconds) }] : [])].map(item => <View key={item.label} style={{ flex: 1, minWidth: 80, gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 26, lineHeight: 32, fontFamily: "Inter_700Bold" }}>{item.value}</Text><Text style={muted}>{item.label}</Text></View>)}
      </View>
      {w.totalSets > 0 ? <View style={{ gap: 8 }}>
        {data.records ? <Text style={{ color: colors.success, fontSize: 15, lineHeight: 22, fontFamily: "Inter_600SemiBold" }}>Новых рекордов в упражнениях: {data.records}</Text> : data.firstExercises ? <Text style={{ color: colors.accent, fontSize: 14, lineHeight: 21 }}>Первые сопоставимые результаты: {data.firstExercises} упр.</Text> : <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>Ещё одна тренировка в копилке.</Text>}
        {data.feedback.breakdown ? <Text style={{ color: colors.amber, fontSize: 13, lineHeight: 20 }}>Техника нарушалась: {data.feedback.breakdown} подх. Проверьте ориентиры перед увеличением нагрузки.</Text> : null}
        {data.feedback.failure ? <Text style={{ color: colors.amber, fontSize: 13, lineHeight: 20 }}>До отказа: {data.feedback.failure} подх.</Text> : null}
        {data.feedback.repSets > data.feedback.rirKnown ? <Text style={muted}>Запас отмечен в {data.feedback.rirKnown} из {data.feedback.repSets} подходов. Неизвестные оценки не считаются подтверждением прогресса.</Text> : null}
      </View> : null}
      {data.exercises.length ? <View style={section}>
        <Text style={title}>Результаты по упражнениям</Text>
        {data.exercises.map(ex => <View key={ex.exerciseId} style={{ gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${ex.name}, история и прогноз`} onPress={() => router.push(`/exercises/${ex.exerciseId}?view=progress`)} style={{ minHeight: 44, flexDirection: "row", gap: 10, alignItems: "center" }}><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ ...title, fontSize: 15 }}>{ex.name}</Text><Text style={muted}>{ex.sets} подх.</Text></View><Feather name="chevron-right" size={18} color={colors.accent} /></Pressable>
          <Text style={{ color: colors.foreground, fontSize: 16, lineHeight: 23, fontFamily: "Inter_600SemiBold" }}>Лучший: {formatSetResult(ex.best)}</Text>
          {formatSetContext(ex.best) ? <Text style={muted}>{formatSetContext(ex.best)}</Text> : null}
          {ex.previous ? <Text style={muted}>Ранее, {formatShortDate(ex.previous.date)}: {formatSetResult(ex.previous.best)}</Text> : null}
          <Text style={{ color: ex.status === "attention" ? colors.amber : ex.status === "record" ? colors.success : ex.status === "first" ? colors.accent : colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>{ex.change}</Text>
          {ex.next ? <Text style={{ color: colors.success, fontSize: 13, lineHeight: 20 }}>Следующий ориентир: {ex.next.result}</Text> : null}
        </View>)}
        <Text style={muted}>Следующие ориентиры рассчитаны сейчас по истории и настройкам. Это не обещание результата; актуальный план учитывает состав следующего занятия.</Text>
      </View> : null}
      <AutomaticWorkoutBackup />
      <View style={section}>
        <Button title="Подходы и исправления" variant="secondary" icon={<Feather name="list" size={18} color={colors.foreground} />} onPress={() => router.push(`/history/${w.id}`)} />
        <Button title="План ближайшего занятия" variant="secondary" icon={<Feather name="calendar" size={18} color={colors.foreground} />} onPress={() => router.push("/programs?view=plan")} />
        <SaveWorkoutTemplate workout={w} />
      </View>
      <View style={section}>
        <Pressable accessibilityRole="button" accessibilityLabel="Подробный разбор" accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)} style={{ minHeight: 44, flexDirection: "row", gap: 10, alignItems: "center" }}><Feather name="bar-chart-2" size={18} color={colors.accent} /><Text style={{ ...title, flex: 1 }}>Подробный разбор</Text><Feather name={details ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable>
        {details ? <><Text style={muted}>{data.groups.map(group => `${group.name}: ${group.sets} подх.`).join(" · ")}</Text><Text style={muted}>Тоннаж: {formatKg(w.totalVolume)}{data.elapsedMinutes == null ? "" : ` · интервал записи: ${formatDuration(data.elapsedMinutes)}`}. Интервал включает паузы и не измеряет активное время.</Text><WorkoutAnalysis workoutId={w.id} /></> : null}
        {connection.data?.enabled ? <><Pressable accessibilityRole="button" accessibilityLabel="Разбор с ИИ-тренером" accessibilityState={{ expanded: ai }} onPress={() => setAi(value => !value)} style={{ minHeight: 44, flexDirection: "row", gap: 10, alignItems: "center" }}><Feather name="zap" size={18} color={colors.success} /><Text style={{ ...title, flex: 1 }}>Разбор с ИИ-тренером</Text><Feather name={ai ? "chevron-up" : "chevron-down"} size={18} color={colors.success} /></Pressable>{ai ? <AiCoachPanel task="review" workoutId={w.id} /> : null}</> : null}
      </View>
    </ScrollView>
    <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderColor: colors.cardBorder }}><Button size="lg" title="На главную" onPress={returnToBrand} icon={<Feather name="home" size={19} color={colors.primaryForeground} />} /></View>
  </View>;
}
