import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { COACH_EVIDENCE, type CoachMessages, type CoachProfile } from "@workspace/ai-coach";
import { getGetWorkoutQueryKey, useGetActiveWorkout, useGetWorkout, type Workout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CoachPlanEditor } from "@/components/CoachPlanEditor";
import { Segmented } from "@/components/Segmented";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAiCoach } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { clearCoachProposal, setCoachProposal } from "@/lib/aiCoachPlan";
import { templateInputErrors, type TemplatePlan } from "@/lib/workoutTemplates";
import { coachRequest } from "@/lib/coachApi";
import type { monthProgress } from "@/lib/coachMonth";

export default function CoachSessionScreen() {
  const { workoutId: rawId, mode: initialMode } = useLocalSearchParams<{ workoutId?: string; mode?: string }>();
  const workoutId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : undefined;
  const [mode, setMode] = useState<"next" | "office" | "month">(initialMode === "office" || initialMode === "month" ? initialMode : "next");
  const [editedPlan, setEditedPlan] = useState<TemplatePlan | null>(null);
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ["ai-profile"], queryFn: () => coachRequest<CoachProfile>("/api/ai-coach/profile"), refetchOnMount: "always" });
  const active = useGetActiveWorkout();
  const workout = useGetWorkout(workoutId ?? 0, { query: { enabled: !!workoutId, queryKey: getGetWorkoutQueryKey(workoutId ?? 0) } });
  const key = `${mode}:${workoutId}:${workout.data?.totalSets}:${workout.data?.finishedAt}`;
  const coach = useAiCoach(workoutId ? "adjust_workout" : mode === "month" ? "month_plan" : "next_workout", workoutId, key, !workoutId && mode === "office" ? "office" : undefined);
  const month = useQuery({ queryKey: ["coach-month"], queryFn: () => coachRequest<ReturnType<typeof monthProgress>>("/api/ai-coach/month") });
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<CoachMessages>([]);
  const [automaticRequest, setAutomaticRequest] = useState<string | null>(null);
  const lastAnswer = useRef("");
  const scroll = useRef<ScrollView>(null);
  const scheduled = month.data?.slots.find(slot => !slot.completed);
  const unavailable = workoutId ? workout.isPending || !workout.data || !!workout.data.finishedAt : active.isPending || active.isError || !!active.data?.workout || (mode === "next" && !!scheduled?.unavailable);
  const reply = coach.answer?.envelope.result;
  const monthly = reply && "monthly" in reply ? reply.monthly : null;
  useEffect(() => {
    if (!coach.answer || coach.answer.envelope.fingerprint === lastAnswer.current) return;
    lastAnswer.current = coach.answer.envelope.fingerprint;
    setEditedPlan(coach.answer.envelope.result.plan ? setCoachProposal(coach.answer.envelope.result, coach.answer.context, coach.answer.envelope) : null);
    setMessages([...(coach.answer.context.messages ?? []), { role: "assistant" as const, text: coach.answer.envelope.result.summary.slice(0, 1000) }].slice(-6));
    setText("");
  }, [coach.answer]);
  useEffect(() => { if (!coach.enabled) { setMessages([]); setText(""); lastAnswer.current = ""; } }, [coach.enabled]);
  useEffect(() => { setMessages([]); setText(""); setEditedPlan(null); setAutomaticRequest(null); lastAnswer.current = ""; }, [mode]);
  const send = () => {
    if (!coach.enabled || coach.busy || unavailable) return;
    const message = text.trim() || (workoutId ? "Предложи оставшуюся часть тренировки с учётом уже выполненного." : mode === "month" ? "Составь полноценный план на четыре недели по моей истории и целям, с расписанием и разумной прогрессией." : mode === "office" ? "Составь короткую офисную тренировку: несколько подходов подтягиваний, отжиманий, брусьев или других упражнений с собственным весом. Есть турник, брусья и место на полу, без дополнительного веса." : "Составь следующую по сохранённому плану тренировку, адаптировав её к истории, моей цели и текущему прогрессу.");
    Keyboard.dismiss();
    if (!text.trim()) setAutomaticRequest(message);
    void coach.ask([...messages.slice(-6), { role: "user", text: message }]);
  };
  const suggestions = workoutId ? [
    { icon: "repeat" as const, label: "Тренажёр занят", message: "Тренажёр для выбранного упражнения занят. Предложи замену только этого упражнения, сохрани остальной план." },
    { icon: "shuffle" as const, label: "Другие мышцы сегодня", message: "Хочу сменить группу мышц на сегодня. Уточни, какую группу я хочу тренировать." },
    { icon: "trending-down" as const, label: "Снизить нагрузку", message: "Сегодня чувствую усталость. Предложи менее объёмную оставшуюся часть тренировки, без повышения веса." },
  ] : [];
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <ScreenHeader title={workoutId ? "Тренер · сейчас" : mode === "month" ? "План на месяц" : mode === "office" ? "Офисная тренировка" : "Тренировка с ИИ"} />
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
      {!coach.enabled ? <Button title="Подключить ИИ-тренера" icon={<Feather name="zap" size={18} color={colors.primaryForeground} />} onPress={() => router.push("/coach")} /> : <>
        {!workoutId ? <>
          <Segmented label="Тренировка" value={mode} options={[{ value: "next", label: "По плану" }, { value: "office", label: "В офисе" }, { value: "month", label: "На месяц" }]} disabled={coach.busy} onChange={setMode} />
          {profile.data ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Цель: {profile.data.goal === "hypertrophy" ? "Мышцы" : profile.data.goal === "strength" ? "Сила" : "Форма"} · {mode === "office" ? "10–20 мин" : "60–90 мин"} · Занятий в неделю: {profile.data.daysPerWeek}</Text> : null}
        </> : null}
        {!workoutId && mode === "month" && month.data ? <Button title="Открыть сохранённый месячный план" variant="secondary" icon={<Feather name="calendar" size={18} color={colors.success} />} onPress={() => router.push("/coach-month")} /> : null}
        {!workoutId && mode === "next" && scheduled ? <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Неделя {scheduled.week} · {scheduled.template.name}</Text> : null}
        {!workoutId && mode === "next" && scheduled?.unavailable ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>Упражнения следующей тренировки удалены. Нужен новый месячный план.</Text> : null}
        {unavailable && !workoutId && active.data?.workout ? <Button title="Открыть текущую тренировку" variant="secondary" onPress={() => router.replace(`/workout/${active.data!.workout!.id}`)} /> : null}
        {workoutId && !workout.isPending && (!workout.data || workout.data.finishedAt) ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 14 }}>{workout.data?.finishedAt ? "Эта тренировка уже завершена." : "Тренировка не найдена."}</Text> : null}
        {active.isError || workout.isError ? <Button title="Повторить загрузку" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void active.refetch(); if (workoutId) void workout.refetch(); }} /> : null}
        {messages.filter(message => message.role !== "user" || message.text !== automaticRequest).map((message, i) => <View key={i} style={{ gap: 6, paddingLeft: 12, borderLeftWidth: 2, borderColor: message.role === "user" ? colors.primary : colors.success }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{message.role === "user" ? "Вы" : "Тренер"}</Text>
          <Text selectable style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{message.text}</Text>
        </View>)}
        {reply?.cautions.map((caution, i) => <Text key={i} style={{ color: colors.amber, fontSize: 13, lineHeight: 19 }}>{caution}</Text>)}
        {reply?.plan && editedPlan ? <View style={{ gap: 12 }}>
          <CoachPlanEditor plan={editedPlan} onChange={setEditedPlan} disabled={coach.busy || unavailable} />
          <Button title={workoutId ? "Применить изменения" : "Начать эту тренировку"} icon={<Feather name="play" size={18} color={colors.primaryForeground} />} disabled={coach.busy || unavailable} onPress={() => { void coach.apply(async (envelope, context) => {
            const error = Object.values(templateInputErrors(editedPlan))[0];
            if (error) throw new Error(error);
            const workout = await coachRequest<Workout>("/api/ai-coach/apply-plan", "POST", { context, fingerprint: envelope.fingerprint, plan: editedPlan });
            clearCoachProposal();
            await client.invalidateQueries();
            router.replace(`/workout/${workout.id}`);
          }); }} />
        </View> : null}
        {monthly ? <View style={{ gap: 14 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>{monthly.name}</Text>
          {monthly.weeks.map(week => <View key={week.week} style={{ gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 14 }}>Неделя {week.week}: {week.sessions.map(i => monthly.templates[i].name).join(" · ")}</Text><Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{week.focus}</Text></View>)}
          {monthly.templates.map((plan, i) => <View key={i} style={{ gap: 6, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 12 }}><Text style={{ color: colors.foreground, fontSize: 15 }}>{plan.name}</Text>{plan.exercises.map(ex => <Text key={ex.exerciseId} style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>{coach.answer!.context.catalog.find(item => item.id === ex.exerciseId)?.name}: {ex.targets.map(set => set.durationSeconds != null ? `${set.durationSeconds} с` : `${set.weightKg} кг × ${set.reps}`).join(" · ")}</Text>)}</View>)}
          <Button title={month.data ? "Заменить месячный план" : "Сохранить месячный план"} icon={<Feather name="save" size={18} color={colors.primaryForeground} />} disabled={coach.busy} onPress={() => { void coach.apply(async (envelope, context) => {
            const result = await coachRequest<ReturnType<typeof monthProgress>>("/api/ai-coach/month", "PUT", { context, fingerprint: envelope.fingerprint, monthly });
            client.setQueryData(["coach-month"], result);
            router.replace("/coach-month");
          }); }} />
        </View> : null}
        {coach.answer ? <View style={{ gap: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>ИИ · {coach.answer.envelope.model}</Text>
          {COACH_EVIDENCE.sources.map(source => <Pressable key={source.url} accessibilityRole="link" onPress={() => { void Linking.openURL(source.url); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Feather name="book-open" size={16} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>{source.title}</Text></Pressable>)}
        </View> : null}
        {coach.error ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>{coach.error}</Text> : null}
        {suggestions.map(suggestion => <Button key={suggestion.label} title={suggestion.label} variant="ghost" icon={<Feather name={suggestion.icon} size={18} color={colors.success} />} disabled={coach.busy || unavailable} onPress={() => { setText(suggestion.message); scroll.current?.scrollToEnd({ animated: true }); }} />)}
      </>}
    </ScrollView>
    {coach.enabled && (workoutId || mode) ? <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 12), gap: 10, borderTopWidth: 1, borderColor: colors.cardBorder }}>
      <TextInput accessibilityLabel="Сообщение тренеру" placeholder={workoutId ? "Что изменить сегодня?" : "Пожелания на сегодня"} placeholderTextColor={colors.mutedForeground} value={text} onChangeText={setText} maxLength={300} multiline textAlignVertical="top" editable={!coach.busy && !unavailable} style={{ minHeight: 48, maxHeight: 96, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.cardBorder, color: colors.foreground, backgroundColor: colors.card, fontSize: 14 }} />
      <Button title={workoutId ? "Отправить тренеру" : coach.answer ? "Отправить уточнение" : mode === "month" ? "Составить месячный план" : "Составить тренировку"} icon={<Feather name="send" size={18} color={colors.primaryForeground} />} loading={coach.busy} disabled={coach.busy || unavailable || ((workoutId != null || !!coach.answer) && !text.trim())} onPress={send} />
    </View> : null}
  </KeyboardAvoidingView>;
}
