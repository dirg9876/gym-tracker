import Feather from "@expo/vector-icons/Feather";
import { getGetExerciseProgressQueryKey, useGetExerciseProgress } from "@workspace/api-client-react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StandardsPanel } from "@/components/StandardsPanel";
import { ExerciseOutlook } from "@/components/ExerciseOutlook";
import { ExerciseWeightStep } from "@/components/ExerciseWeightStep";
import { ExerciseAnatomy } from "@/components/ExerciseAnatomy";
import { ExerciseProgressChart } from "@/components/ExerciseProgressChart";
import { ExerciseJournal } from "@/components/ExerciseJournal";
import { Segmented } from "@/components/Segmented";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { Button } from "@/components/Button";
import type { ExerciseOutlook as Outlook } from "@/lib/exerciseOutlook";
import type { InsightExercise } from "@/lib/trainingInsights";
import { coachRequest } from "@/lib/coachApi";
import type { RankedExercise } from "@/lib/exerciseStandards";
import { useColors } from "@/hooks/useColors";
import { formatKg } from "@/lib/format";
import { maxDurationOf, formatSeconds, isTimedExercise } from "@/lib/workoutMeasurement";
import { isAssisted, type ConfiguredExercise } from "@/lib/equipmentSettings";

export default function ExerciseProgressScreen() {
  const colors = useColors(), insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; view?: string }>();
  const id = parseInt(params.id || "0", 10);
  const [stepSaving, setStepSaving] = useState(false);
  const [view, setView] = useState(params.view === "progress" ? "progress" : "muscles");
  const [editing, setEditing] = useState(false), [records, setRecords] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const outlook = useQuery({ queryKey: ["exercise-outlook", id], queryFn: () => coachRequest<Outlook>(`/api/exercises/${id}/outlook`), enabled: !!id && view === "progress", refetchOnMount: "always" });
  const journal = useQuery({ queryKey: ["exercise-journal", id], queryFn: () => coachRequest<InsightExercise | null>(`/api/exercises/${id}/insights`), enabled: !!id && view === "progress" });
  const { data: progress, isLoading, isError, refetch } = useGetExerciseProgress(id, {
    query: { enabled: !!id, queryKey: getGetExerciseProgressQueryKey(id) },
  });
  useFocusEffect(useCallback(() => {
    void refetch();
    if (view === "progress") { void outlook.refetch(); void journal.refetch(); }
  }, [refetch, outlook.refetch, journal.refetch, view]));

  if (isLoading) return <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>;
  if (!progress) return <View style={{ flex: 1, backgroundColor: colors.background }}><ScreenHeader title={isError ? "Упражнение" : "Не найдено"} />{isError ? <View style={{ padding: 16 }}><Button title="Повторить загрузку" onPress={() => { void refetch(); }} /></View> : null}</View>;
  const { exercise, points } = progress;
  const ranked = exercise as RankedExercise, timed = isTimedExercise(exercise.name);
  const repBased = ranked.standard?.unit === "reps";
  const section = { gap: 12, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 16 };
  const title = { color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title={exercise.name} subtitle={exercise.muscleGroup} />
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
      <Segmented label="Раздел упражнения" value={view} options={[{ value: "muscles", label: "Мышцы" }, { value: "progress", label: "Прогресс" }, ...(!timed ? [{ value: "settings", label: "Настройки" }] : [])]} disabled={stepSaving} onChange={value => { setView(value); scroll.current?.scrollTo({ y: 0, animated: false }); }} />
    </View>
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 20 }}>
      {view === "muscles" ? <ExerciseAnatomy exercise={exercise} /> : null}
      {view === "settings" ? <View style={{ gap: 16 }}>
        {!timed ? <ExerciseWeightStep key={id} exercise={exercise as ConfiguredExercise} onPendingChange={setStepSaving} /> : null}
        <Button title="Категория и параметры" variant="secondary" disabled={stepSaving} icon={<Feather name="sliders" size={18} color={colors.foreground} />} onPress={() => setEditing(true)} />
      </View> : null}
      {view === "progress" ? <>
        {outlook.isPending || journal.isPending ? <ActivityIndicator color={colors.accent} /> : outlook.isError || journal.isError || !outlook.data ? <Button title="Повторить загрузку прогресса" variant="secondary" onPress={() => { void outlook.refetch(); void journal.refetch(); }} /> : <>
          <ExerciseProgressChart key={id} outlook={outlook.data} history={journal.data ?? undefined} />
          <View style={section}><Text style={title}>Следующие тренировки</Text><ExerciseOutlook key={id} outlook={outlook.data} compact showChart={false} /></View>
          <View style={section}><Text style={title}>История за всё время</Text>{journal.data ? <ExerciseJournal key={id} item={journal.data} /> : <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Нет завершённых подходов этого упражнения</Text>}</View>
        </>}
        <View style={section}>
          <Pressable accessibilityRole="button" accessibilityLabel="Рекорды и нормативы" accessibilityState={{ expanded: records }} onPress={() => setRecords(value => !value)} style={{ minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name="award" size={18} color={colors.accent} /><Text style={{ ...title, flex: 1 }}>Рекорды и нормативы</Text><Feather name={records ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable>
          {records ? <>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{timed ? `Рекорд удержания: ${formatSeconds(Math.max(0, ...points.map(maxDurationOf)))}` : repBased ? `Лучший подход: ${ranked.rankBest ?? 0} повт.` : `${isAssisted(exercise) ? "Расчётная нагрузка" : "Максимальный вес"}: ${formatKg(Math.max(0, ...points.map(p => p.maxWeight)))}`}</Text>
            {ranked.standard ? <StandardsPanel standard={ranked.standard} best={ranked.rankBest ?? 0} /> : null}
          </> : null}
        </View>
      </> : null}
    </ScrollView>
    {editing ? <ExerciseEditor exercise={exercise} onClose={() => setEditing(false)} /> : null}
  </View>;
}
