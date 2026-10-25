import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useListExercises } from "@workspace/api-client-react";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ScreenHeader } from "@/components/ScreenHeader";
import { loadAiContext } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { assertCoachAnswerCurrent } from "@/lib/aiCoachConnection";
import { clearCoachMonthProposal, getCoachMonthProposal } from "@/lib/aiCoachPlan";
import { coachRequest } from "@/lib/coachApi";
import type { monthProgress } from "@/lib/coachMonth";

export default function CoachMonthScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const router = useRouter(); const client = useQueryClient();
  const [proposal, setProposal] = useState(getCoachMonthProposal);
  const saved = useQuery({ queryKey: ["coach-month"], queryFn: () => coachRequest<ReturnType<typeof monthProgress>>("/api/ai-coach/month") });
  useFocusEffect(useCallback(() => { void saved.refetch(); }, [saved.refetch]));
  const catalog = useListExercises();
  const proposed = proposal && "monthly" in proposal.envelope.result ? proposal.envelope.result.monthly : null;
  const plan = proposed ?? saved.data?.saved.plan;
  const save = useMutation({ mutationFn: async () => {
    if (!proposal || !proposed) return;
    const { context, envelope } = proposal;
    await assertCoachAnswerCurrent(envelope, await loadAiContext(context.task, undefined, context.messages));
    const result = await coachRequest<ReturnType<typeof monthProgress>>("/api/ai-coach/month", "PUT", { context, fingerprint: envelope.fingerprint, monthly: proposed });
    client.setQueryData(["coach-month"], result);
    clearCoachMonthProposal(); setProposal(null);
  }, onError: error => Alert.alert("План не сохранён", error instanceof Error ? error.message : "Повторите попытку.") });
  const confirmSave = () => {
    if (saved.data) Alert.alert("Заменить месячный план?", "Выполненные тренировки останутся в истории.", [{ text: "Отмена", style: "cancel" }, { text: "Заменить", onPress: () => save.mutate() }]);
    else save.mutate();
  };
  const remove = useMutation({ mutationFn: () => coachRequest("/api/ai-coach/month", "DELETE"), onSuccess: () => client.setQueryData(["coach-month"], null), onError: error => Alert.alert("План не удалён", error instanceof Error ? error.message : "Повторите попытку.") });
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title="Месячный план" />
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 20 }}>
      {!plan && saved.isPending ? <ActivityIndicator color={colors.primary} /> : !plan ? <Button title="Составить план на месяц" icon={<Feather name="calendar" size={18} color={colors.primaryForeground} />} onPress={() => router.push("/coach-session?mode=month")} /> : <>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 20 }}>{plan.name}</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>4 недели · занятий в неделю: {plan.daysPerWeek}{!proposed && saved.data ? ` · выполнено ${saved.data.slots.filter(slot => slot.completed).length}/${saved.data.slots.length}` : ""}</Text>
        <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{plan.overview}</Text>
        {plan.weeks.map(week => <View key={week.week} style={{ gap: 10, paddingTop: 16, borderTopWidth: 1, borderColor: colors.cardBorder }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>Неделя {week.week}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{week.focus}</Text>
          {week.sessions.map((index, position) => {
            const completed = !proposed && saved.data?.slots.find(slot => slot.week === week.week && slot.session === position + 1)?.completed;
            return <View key={position} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Feather name={completed ? "check-circle" : "circle"} size={17} color={completed ? colors.success : colors.mutedForeground} /><Text style={{ flex: 1, color: completed ? colors.success : colors.foreground, fontSize: 14 }}>День {1 + Math.floor(position * 7 / plan.daysPerWeek)} · {plan.templates[index].name}</Text></View>;
          })}
        </View>)}
        {plan.templates.map((template, i) => <View key={i} style={{ gap: 10, paddingTop: 16, borderTopWidth: 1, borderColor: colors.cardBorder }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>{template.name}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{template.description}</Text>
          {template.exercises.map(ex => <View key={ex.exerciseId} style={{ gap: 4 }}><Text style={{ color: colors.foreground, fontSize: 14 }}>{catalog.data?.find(item => item.id === ex.exerciseId)?.name ?? proposal?.context.catalog.find(item => item.id === ex.exerciseId)?.name ?? "Удалённое упражнение"} · {ex.targets.length} подх.</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{ex.targets.map(set => set.durationSeconds != null ? `${set.durationSeconds} с` : `${set.weightKg == null ? "вес подбирается" : `${set.weightKg} кг`} × ${set.reps}`).join(" · ")}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ex.reason}</Text></View>)}
        </View>)}
        {proposed ? <Button title="Сохранить план на месяц" icon={<Feather name="save" size={18} color={colors.primaryForeground} />} onPress={confirmSave} disabled={save.isPending} loading={save.isPending} /> : <>
          {saved.data?.slots.some(slot => !slot.completed) ? <Button title="Ближайшее занятие" disabled={saved.data.slots.find(slot => !slot.completed)?.unavailable} icon={<Feather name="arrow-right" size={18} color={colors.primaryForeground} />} onPress={() => router.push("/start-workout" as Href)} /> : <Text style={{ color: colors.success, fontSize: 16 }}>Месячный план выполнен</Text>}
          {saved.data?.slots.find(slot => !slot.completed)?.unavailable ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>Упражнения следующей тренировки удалены. Нужен новый месячный план.</Text> : null}
          <Button title="Составить новый месячный план" variant="secondary" icon={<Feather name="calendar" size={18} color={colors.foreground} />} onPress={() => router.push("/coach-session?mode=month")} />
          <Button title="Удалить месячный план" variant="ghost" disabled={remove.isPending} loading={remove.isPending} icon={<Feather name="trash-2" size={18} color={colors.foreground} />} onPress={() => Alert.alert("Удалить месячный план?", "Выполненные тренировки останутся в истории.", [{ text: "Отмена", style: "cancel" }, { text: "Удалить", style: "destructive", onPress: () => remove.mutate() }])} />
        </>}
      </>}
      {saved.isError ? <Button title="Повторить загрузку" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void saved.refetch(); }} /> : null}
    </ScrollView>
  </View>;
}
