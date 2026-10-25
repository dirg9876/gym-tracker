import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { useListExercises } from "@workspace/api-client-react";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { equalSetValues, setValues, setValuesSchema, type EditableSet } from "@/lib/setEditing";
import { isAssisted, weightStep, type ConfiguredExercise } from "@/lib/equipmentSettings";
import { formatDate, formatKg } from "@/lib/format";
import { isTimedExercise, minimumWeight, weightLabel } from "@/lib/workoutMeasurement";
import { retryDraftAction } from "@/lib/workoutDraft";
import { Stepper } from "./Stepper";
import { Segmented } from "./Segmented";
import { Button } from "./Button";
import { useToast } from "./Toast";

export function SetEditor({ set, onClose }: { set: EditableSet; onClose: () => void }) {
  const colors = useColors(), insets = useSafeAreaInsets(), client = useQueryClient(), toast = useToast();
  const [baseline, setBaseline] = useState(set), [values, change] = useState(() => setValues(set));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const { data: catalog } = useListExercises();
  const configured = catalog?.find(ex => ex.id === baseline.exerciseId) as ConfiguredExercise | undefined;
  const step = configured?.equipment === baseline.equipment ? weightStep(configured) : baseline.equipment === "dumbbell" ? 0.5 : 2.5;
  const timed = baseline.durationSeconds != null || isTimedExercise(baseline.exerciseName), assisted = isAssisted(baseline);
  const dirty = !equalSetValues(setValues(baseline), values);
  const close = () => { if (!lock.current) onClose(); };
  const load = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { const row = await coachRequest<EditableSet>(`/api/sets/${baseline.id}`); setBaseline(row); change(setValues(row)); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить подход"); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (lock.current || !dirty) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await retryDraftAction(() => coachRequest<EditableSet>(`/api/sets/${baseline.id}`, "PATCH", { revision: baseline.revision ?? 0, values }));
      await client.invalidateQueries();
      onClose(); toast.show("success", "Подход исправлен");
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить подход"); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal visible animationType="slide" onRequestClose={close}>
    <GestureHandlerRootView style={{ flex: 1 }}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: colors.cardBorder }}><Text style={{ flex: 1, color: colors.foreground, fontSize: 17, fontFamily: "Inter_700Bold" }}>Исправить подход</Text><Pressable accessibilityRole="button" accessibilityLabel="Закрыть редактор подхода" disabled={busy} onPress={close} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={22} color={colors.foreground} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 18 }}>
        <View style={{ gap: 6 }}><Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>{baseline.exerciseName}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{formatDate(baseline.createdAt)}{baseline.dumbbellCount === 2 ? " · две гантели" : ""}{baseline.bodyWeightKg != null ? ` · масса тела ${formatKg(baseline.bodyWeightKg)}` : ""}</Text></View>
        {timed ? <Stepper label="Время удержания" unit="с" value={values.durationSeconds ?? 0} min={1} max={86400} step={5} chips={[15, 30, 45, 60, 90]} disabled={busy} onChange={durationSeconds => change(v => ({ ...v, durationSeconds, weightKg: 0, reps: 0, rir: null }))} /> : <>
          <Stepper label={assisted ? "Противовес" : weightLabel(baseline.equipment)} value={values.weightKg} min={minimumWeight(baseline.equipment ?? "other")} max={assisted ? baseline.bodyWeightKg : undefined} step={step} disabled={busy} onChange={weightKg => change(v => ({ ...v, weightKg }))} />
          <Stepper label="Повторения" value={values.reps} min={1} step={1} disabled={busy} onChange={reps => change(v => ({ ...v, reps }))} />
          <Segmented numeric label="Запас повторений (RIR)" value={values.rir == null ? "unknown" : String(values.rir)} options={[{ value: "unknown", label: "Не знаю" }, ...[0, 1, 2, 3, 4, 5].map(n => ({ value: String(n), label: n === 5 ? "5+" : String(n) }))]} disabled={busy} onChange={v => change(current => ({ ...current, rir: v === "unknown" ? null : Number(v) }))} />
        </>}
        <Segmented label="Техника" value={values.technique ?? "unknown"} options={[{ value: "unknown", label: "Не отмечена" }, { value: "good", label: "Сохранена" }, { value: "breakdown", label: "Нарушалась" }]} disabled={busy} onChange={v => change(current => ({ ...current, technique: v === "unknown" ? null : v as "good" | "breakdown" }))} />
        {error ? <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13, lineHeight: 20 }}>{error}</Text><Button title="Загрузить актуальный подход" variant="secondary" disabled={busy} icon={<Feather name="refresh-cw" size={16} color={colors.foreground} />} onPress={() => { void load(); }} /></View> : null}
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: Math.max(16, insets.bottom), borderTopWidth: 1, borderColor: colors.cardBorder }}><Button title="Сохранить исправление" loading={busy} disabled={busy || !dirty || !setValuesSchema.safeParse(values).success} icon={<Feather name="check" size={18} color={colors.primaryForeground} />} onPress={() => { void save(); }} /></View>
    </KeyboardAvoidingView></GestureHandlerRootView>
  </Modal>;
}
