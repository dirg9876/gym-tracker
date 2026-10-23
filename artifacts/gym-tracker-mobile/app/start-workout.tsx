import Feather from "@expo/vector-icons/Feather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetActiveWorkoutQueryKey, getListWorkoutsQueryKey, type Workout } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CoachPlanEditor } from "@/components/CoachPlanEditor";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TrainingBasis } from "@/components/TrainingBasis";
import { useAiCoach } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { setCoachProposal, clearCoachProposal } from "@/lib/aiCoachPlan";
import { formatDate } from "@/lib/format";
import type { DailyPreview } from "@/lib/dailyWorkout";
import type { TemplatePlan } from "@/lib/workoutTemplates";
import type { SplitDay } from "@/lib/adaptiveWorkout";

export default function StartWorkoutScreen() {
  const colors = useColors(), insets = useSafeAreaInsets(), router = useRouter(), client = useQueryClient();
  const [splitDay, setSplitDay] = useState<SplitDay>();
  const preview = useQuery({ queryKey: ["daily-workout", splitDay ?? "auto"], queryFn: () => coachRequest<DailyPreview>(`/api/daily-workout${splitDay ? `?split=${splitDay}` : ""}`), refetchOnMount: "always", retry: false });
  const [plan, setPlan] = useState<TemplatePlan | null>(null);
  const [appliedReview, setAppliedReview] = useState<{ summary: string; cautions: string[] } | null>(null);
  const [starting, setStarting] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef(false), asked = useRef<string | null>(null), mounted = useRef(true);
  const coach = useAiCoach("next_workout", undefined, preview.data?.fingerprint ?? "", undefined, preview.data?.splitDay);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!preview.data) return;
    if (preview.data.activeWorkoutId) { router.replace(`/workout/${preview.data.activeWorkoutId}`); return; }
    setPlan(preview.data.plan); setError(null); setAppliedReview(null);
  }, [preview.data?.fingerprint]);
  useEffect(() => {
    if (!preview.data?.plan || preview.data.activeWorkoutId || !preview.data.coachSupported || !coach.enabled || coach.busy || pending.current || asked.current === preview.data.fingerprint) return;
    asked.current = preview.data.fingerprint;
    void coach.ask([{ role: "user", text: "Проверь готовую тренировку preparedWorkout, рассчитанную приложением на сегодня. Учти историю и цель. Дай краткий комментарий и только обоснованные улучшения. Если правки не нужны, верни plan=null. Не заменяй локальные веса произвольными." }]);
  }, [preview.data?.fingerprint, coach.enabled, coach.busy]);
  const start = async (manual: boolean) => {
    if (pending.current) return;
    pending.current = true; setStarting(true); setError(null);
    try {
      const workout = await coachRequest<Workout>(manual ? "/api/workouts" : "/api/daily-workout/start", "POST", manual ? {} : { fingerprint: preview.data?.fingerprint, splitDay: preview.data?.splitDay, plan });
      clearCoachProposal();
      client.setQueryData(getGetActiveWorkoutQueryKey(), { workout });
      await client.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
      void client.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      client.removeQueries({ queryKey: ["daily-workout"] });
      if (mounted.current) router.replace(`/workout/${workout.id}`);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Не удалось начать тренировку."); }
    finally { pending.current = false; if (mounted.current) setStarting(false); }
  };
  const review = coach.answer?.envelope.result ?? appliedReview;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title="Тренировка на сегодня" />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 18 }}>
      {preview.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {preview.data ? <>
        <Text style={{ color: colors.accent, fontSize: 13 }}>{formatDate(`${preview.data.date}T12:00:00`)}</Text>
        {preview.data.choices.length > 1 ? <View accessibilityRole="radiogroup" style={{ gap: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" }}>Выберите сплит</Text>
          {preview.data.choices.map(choice => <Pressable key={choice.splitDay} accessibilityRole="radio" accessibilityLabel={choice.plan!.name.replace("Сплит · ", "")} accessibilityState={{ checked: choice.splitDay === preview.data.splitDay, disabled: starting }} disabled={starting} onPress={() => setSplitDay(choice.splitDay)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 56, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
            <Feather name={choice.splitDay === preview.data.splitDay ? "check-circle" : "circle"} size={22} color={choice.splitDay === preview.data.splitDay ? colors.success : colors.mutedForeground} />
            <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>{choice.plan!.name.replace("Сплит · ", "")}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{choice.plan!.exercises.length} упр. · {choice.plan!.exercises.reduce((sum, ex) => sum + ex.sets + (ex.postCalibrationSets ?? 0), 0)} подх.</Text></View>
          </Pressable>)}
        </View> : null}
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>{preview.data.reason}</Text>
        {plan ? <CoachPlanEditor plan={plan} onChange={setPlan} readOnly disabled={starting} /> : <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Нет упражнений для выбранного оборудования.</Text>}
        {plan ? <TrainingBasis /> : null}
      </> : null}
      {coach.enabled && preview.data?.coachSupported && plan ? <View style={{ gap: 10, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 16 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name="zap" size={18} color={colors.success} /><Text style={{ color: colors.success, fontSize: 15, fontFamily: "Inter_600SemiBold" }}>Комментарий тренера</Text>{coach.busy ? <ActivityIndicator size="small" color={colors.success} /> : null}</View>
        {review ? <>
          <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{review.summary}</Text>
          {review.cautions.map((text, i) => <Text key={i} style={{ color: colors.amber, fontSize: 13, lineHeight: 20 }}>{text}</Text>)}
          {coach.answer?.envelope.result.plan ? <Button title="Применить корректировки" variant="secondary" disabled={starting || coach.busy} icon={<Feather name="check" size={18} color={colors.success} />} onPress={() => { void coach.apply(async (envelope, context) => { if (pending.current || !mounted.current) return; setPlan(setCoachProposal(envelope.result, context, envelope)); setAppliedReview({ summary: envelope.result.summary, cautions: envelope.result.cautions }); }); }} /> : null}
          {appliedReview ? <Text style={{ color: colors.success, fontSize: 13 }}>Корректировки применены</Text> : null}
        </> : coach.busy ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Проверка плана...</Text> : null}
        {coach.error ? <Text style={{ color: colors.amber, fontSize: 13 }}>Проверка ИИ недоступна. Локальный план сохранён.</Text> : null}
      </View> : null}
      {preview.isError || error ? <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>{error || "Не удалось подготовить предложение. Прогресс сохранён."}</Text><Button title="Обновить предложение" variant="secondary" disabled={starting} icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { asked.current = null; void preview.refetch(); }} /></View> : null}
    </ScrollView>
    <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12), gap: 10, borderTopWidth: 1, borderColor: colors.cardBorder }}>
      {plan ? <Button title="Начать эту тренировку" size="lg" loading={starting} disabled={starting || preview.isFetching} icon={<Feather name="play" size={20} color={colors.primaryForeground} />} onPress={() => { void start(false); }} /> : null}
      <Button title="Начать самостоятельно" variant={plan ? "ghost" : "primary"} disabled={starting} icon={<Feather name="edit-3" size={18} color={plan ? colors.foreground : colors.primaryForeground} />} onPress={() => { void start(true); }} />
    </View>
  </View>;
}
