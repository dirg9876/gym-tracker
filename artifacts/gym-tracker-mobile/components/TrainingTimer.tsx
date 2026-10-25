import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, AppState, Pressable, Text, Vibration, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { extendTimer, pauseTimer, remainingMs, resumeTimer, startTimer, type TrainingTimer as Timer } from "@/lib/trainingCoach";
import { Button } from "./Button";
import { Stepper } from "./Stepper";
import { ProgressTrack } from "./ProgressTrack";
import { countdownLabel } from "@/lib/displayProgress";

export function TrainingTimer({ workoutId, plank, seconds, restSignal, disabled = false, compact = false, onTransfer }: { workoutId: number; plank?: { id: number; name: string }; seconds: number; restSignal: number; disabled?: boolean; compact?: boolean; onTransfer: (timer: Timer) => Promise<{ timer: Timer | null; restSeconds: number }> }) {
  const colors = useColors();
  const client = useQueryClient();
  const url = `/api/workouts/${workoutId}/timer`;
  const key = ["coach-timer", workoutId];
  type TimerResponse = { timer: Timer | null; restSeconds: number };
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: key, queryFn: () => coachRequest<TimerResponse>(url), refetchOnMount: "always" });
  const timer = data?.timer;
  const [now, setNow] = useState(Date.now());
  const restSeconds = data?.restSeconds ?? 120;
  const [configure, setConfigure] = useState(false);
  const handledRest = useRef(restSignal);
  const notifiedDeadline = useRef<number | null>(null);
  const mutation = useMutation({
    mutationFn: (next: Timer | null | { restSeconds: number }) => coachRequest<TimerResponse>(url, next && "restSeconds" in next ? "POST" : next ? "PUT" : "DELETE", next ?? undefined),
    onSuccess: result => { client.setQueryData(key, result); setNow(Date.now()); },
    onError: () => Alert.alert("Таймер не сохранён", "Повторите действие."),
  });
  useFocusEffect(useCallback(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    const sync = (state: string) => {
      if (tick) clearInterval(tick);
      if (state === "active") {
        setNow(Date.now());
        void refetch();
        tick = setInterval(() => setNow(Date.now()), 1000);
      }
    };
    sync(AppState.currentState);
    const subscription = AppState.addEventListener("change", sync);
    return () => { if (tick) clearInterval(tick); subscription.remove(); };
  }, [refetch]));
  useEffect(() => {
    if (restSignal === handledRest.current) return;
    if (disabled || mutation.isPending || isLoading) return;
    handledRest.current = restSignal;
    if (!timer || timer.kind === "rest") mutation.mutate(startTimer("rest", restSeconds));
  }, [restSignal, restSeconds, timer, mutation, isLoading, disabled]);
  const left = timer ? remainingMs(timer, now) : 0;
  useEffect(() => {
    if (timer?.endsAt != null && left === 0 && notifiedDeadline.current !== timer.endsAt && AppState.currentState === "active") {
      notifiedDeadline.current = timer.endsAt;
      Vibration.vibrate(200);
    }
  }, [timer, left]);
  const finishPlank = async () => {
    if (!timer || timer.kind !== "plank") return;
    const elapsed = Math.floor((timer.totalMs - remainingMs(timer)) / 1000);
    if (elapsed < 1) return;
    try { const result = await onTransfer(timer); client.setQueryData(key, { timer: result.timer, restSeconds: result.restSeconds }); }
    catch (error) { Alert.alert("Время не перенесено", error instanceof Error ? error.message : "Повторите действие."); }
  };
  const replace = (next: Timer) => {
    if (disabled) return;
    if (timer && (remainingMs(timer) > 0 || timer.kind === "plank")) Alert.alert("Заменить таймер?", timer.kind === "plank" ? "Время текущего удержания не будет перенесено в подход." : "Текущий отсчёт будет сброшен.", [{ text: "Отмена", style: "cancel" }, { text: "Заменить", onPress: () => mutation.mutate(startTimer(next.kind, next.totalMs / 1000, next.exerciseId)) }]);
    else mutation.mutate(next);
  };
  if (compact) return <View style={{ gap: 8, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
    {isError ? <Button variant="secondary" title="Повторить загрузку таймера" onPress={() => { void refetch(); }} /> : <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 56 }}>
      <View style={{ flex: 1, minWidth: 68, gap: 2 }}><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{timer?.kind === "plank" ? "Удержание" : "Отдых"}{timer?.endsAt == null && left > 0 ? " · пауза" : ""}</Text><Text accessibilityLabel="Осталось времени" style={{ color: timer && left === 0 ? colors.success : colors.foreground, fontSize: 24, lineHeight: 30, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{isLoading ? "..." : timer ? countdownLabel(left) : `${restSeconds} с`}</Text></View>
      {!timer && !isLoading ? <Pressable accessibilityRole="button" accessibilityLabel={`Начать отдых: ${restSeconds} с`} disabled={disabled || mutation.isPending} onPress={() => replace(startTimer("rest", restSeconds))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="play" size={21} color={colors.primary} /></Pressable> : null}
      {timer?.kind === "rest" ? <Pressable accessibilityRole="button" accessibilityLabel="Добавить 30 секунд отдыха" disabled={disabled || mutation.isPending || timer.totalMs > 86370000} onPress={() => mutation.mutate(extendTimer(timer, 30))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="plus" size={17} color={colors.foreground} /><Text style={{ color: colors.foreground, fontSize: 10 }}>30 с</Text></Pressable> : null}
      {timer && left > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={timer.endsAt == null ? "Продолжить таймер" : "Пауза таймера"} disabled={disabled || mutation.isPending} onPress={() => mutation.mutate(timer.endsAt == null ? resumeTimer(timer) : pauseTimer(timer))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name={timer.endsAt == null ? "play" : "pause"} size={21} color={colors.primary} /></Pressable> : null}
      {timer ? <Pressable accessibilityRole="button" accessibilityLabel="Сбросить таймер" disabled={disabled || mutation.isPending} onPress={() => mutation.mutate(null)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Настроить длительность отдыха" accessibilityState={{ expanded: configure }} onPress={() => setConfigure(v => !v)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="sliders" size={18} color={colors.mutedForeground} /></Pressable>
    </View>}
    {configure ? <Stepper label="Отдых после подхода" unit="с" value={restSeconds} disabled={disabled || mutation.isPending} onChange={value => mutation.mutate({ restSeconds: value })} min={30} max={900} step={30} chips={[60, 120, 180, 300]} /> : null}
    {timer?.kind === "plank" ? <Button title="Перенести время в подход" variant="secondary" disabled={disabled || mutation.isPending || timer.totalMs - left < 1000} onPress={finishPlank} icon={<Feather name="check" size={16} color={colors.foreground} />} /> : plank ? <Button title={`Удержание · ${seconds} с`} variant="secondary" disabled={disabled || mutation.isPending} onPress={() => replace(startTimer("plank", seconds, plank.id))} icon={<Feather name="play" size={16} color={colors.foreground} />} /> : null}
  </View>;
  return <View style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Feather name="clock" size={16} color={timer && left === 0 ? colors.success : colors.accent} />
      <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Таймер</Text>
      {!timer && !isLoading && !isError ? <Pressable accessibilityRole="button" accessibilityLabel={`Начать отдых: ${restSeconds} с`} disabled={disabled || mutation.isPending} onPress={() => replace(startTimer("rest", restSeconds))} style={{ flexShrink: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 }}><Feather name="play" size={18} color={colors.primary} /><Text style={{ color: colors.foreground, fontSize: 13 }}>Отдых · {restSeconds} с</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Настроить длительность отдыха" accessibilityState={{ expanded: configure }} onPress={() => setConfigure(value => !value)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="sliders" size={18} color={colors.mutedForeground} /></Pressable>
    </View>
    {isLoading ? <Text style={{ color: colors.mutedForeground }}>Загрузка...</Text> : isError ? <Button variant="secondary" title="Повторить загрузку таймера" onPress={() => { void refetch(); }} /> : <>
      {timer ? <>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: left === 0 ? colors.success : colors.mutedForeground, fontSize: 12 }}>{timer.kind === "rest" ? left === 0 ? "Отдых завершён" : "Отдых" : "Удержание"}{timer.endsAt == null && left > 0 ? " · пауза" : ""}</Text>
            <Text accessibilityLabel="Осталось времени" style={{ color: left === 0 ? colors.success : colors.foreground, fontSize: 36, lineHeight: 44, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"] }}>{countdownLabel(left)}</Text>
          </View>
          {timer.kind === "rest" ? <Pressable accessibilityRole="button" accessibilityLabel="Добавить 30 секунд отдыха" disabled={disabled || mutation.isPending || timer.totalMs > 86370000} onPress={() => mutation.mutate(extendTimer(timer, 30))} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Feather name="plus" size={18} color={colors.foreground} /><Text style={{ color: colors.foreground, fontSize: 12 }}>30 с</Text></Pressable> : null}
          {left > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={timer.endsAt == null ? "Продолжить таймер" : "Пауза таймера"} disabled={disabled || mutation.isPending} onPress={() => mutation.mutate(timer.endsAt == null ? resumeTimer(timer) : pauseTimer(timer))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name={timer.endsAt == null ? "play" : "pause"} size={22} color={colors.primary} /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Сбросить таймер" disabled={disabled || mutation.isPending} onPress={() => mutation.mutate(null)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
        </View>
        <ProgressTrack value={timer.totalMs - left} total={timer.totalMs} label={left === 0 ? "Таймер завершён" : timer.kind === "rest" ? "Ход отдыха" : "Ход удержания"} color={left === 0 ? colors.success : colors.accent} />
        {timer.kind === "plank" ? <Button title="Перенести время в подход" variant="secondary" disabled={disabled || mutation.isPending || timer.totalMs - left < 1000} onPress={finishPlank} icon={<Feather name="check" size={16} color={colors.foreground} />} /> : null}
      </> : null}
      {configure ? <View style={{ gap: 12 }}>
        <Stepper label="Отдых после подхода" unit="с" value={restSeconds} disabled={disabled || mutation.isPending} onChange={value => mutation.mutate({ restSeconds: value })} min={30} max={900} step={30} chips={[60, 120, 180, 300]} />
        {timer ? <Button title={`Начать отдых · ${restSeconds} с`} variant="secondary" disabled={disabled || mutation.isPending} onPress={() => replace(startTimer("rest", restSeconds))} icon={<Feather name="clock" size={16} color={colors.foreground} />} /> : null}
      </View> : null}
      {plank && timer?.kind !== "plank" ? <Button title={`Удержание · ${seconds} с`} variant="secondary" disabled={disabled || mutation.isPending} onPress={() => replace(startTimer("plank", seconds, plank.id))} icon={<Feather name="play" size={16} color={colors.foreground} />} /> : null}
    </>}
  </View>;
}
