import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button } from "./Button";
import { Stepper } from "./Stepper";
import { useToast } from "./Toast";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { weightStep, WEIGHT_STEP_PRESETS, type ConfiguredExercise } from "@/lib/equipmentSettings";

export function ExerciseWeightStep({ exercise, onPendingChange, disabled = false, onSaved }: { exercise: ConfiguredExercise; onPendingChange: (pending: boolean) => void; disabled?: boolean; onSaved?: () => void }) {
  const client = useQueryClient(), colors = useColors(), toast = useToast();
  const [draft, setDraft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = weightStep(exercise), dirty = draft != null && draft !== current;
  const update = useMutation({ mutationFn: (weightStepKg: number) => coachRequest<ConfiguredExercise>(`/api/exercises/${exercise.id}`, "PATCH", { weightStepKg }) });
  const save = async () => {
    if (draft == null || draft === current || lock.current || disabled) return;
    lock.current = true; setBusy(true); onPendingChange(true);
    let saved = false;
    try {
      await update.mutateAsync(draft);
      await client.invalidateQueries();
      setDraft(null);
      toast.show("success", "Шаг веса сохранён");
      saved = true;
    } catch (error) { toast.show("error", error instanceof Error ? error.message : "Не удалось сохранить шаг веса."); }
    finally { lock.current = false; setBusy(false); onPendingChange(false); }
    if (saved) onSaved?.();
  };
  return <View style={{ gap: 10, paddingBottom: 18, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
    <Stepper label="Шаг веса" unit="кг" value={draft ?? current} onChange={value => { update.reset(); setDraft(value); }} min={0.25} max={20} step={0.25} chips={WEIGHT_STEP_PRESETS} disabled={busy || disabled} />
    {dirty || busy ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <View style={{ flex: 1 }}><Button title="Сохранить шаг веса" icon={<Feather name="check" size={18} color={colors.primaryForeground} />} loading={busy} disabled={busy || disabled} onPress={() => { void save(); }} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Отменить изменение шага" disabled={busy || disabled} onPress={() => { update.reset(); setDraft(null); }} onLongPress={() => toast.show("info", "Отменить изменение шага")} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Feather name="x" size={20} color={colors.mutedForeground} /></Pressable>
    </View> : null}
    {update.isError ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 12 }}>Шаг не сохранён. Повторите попытку.</Text> : null}
  </View>;
}
