import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Stepper } from "./Stepper";
import { formatKg } from "@/lib/format";
import { minimumWeight, weightLabel } from "@/lib/workoutMeasurement";
import { withSetTargets, type SetTarget, type TemplatePlan } from "@/lib/workoutTemplates";

export function CoachPlanEditor({ plan, onChange, disabled }: { plan: TemplatePlan; onChange: (plan: TemplatePlan) => void; disabled: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState<number | null>(null);
  const update = (index: number, targets: SetTarget[]) => onChange({ ...plan, exercises: plan.exercises.map((ex, i) => i === index ? withSetTargets(ex, targets) : ex) });
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>{plan.name}</Text>
    {plan.exercises.map((ex, index) => <View key={ex.exerciseId} style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 12, gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Изменить: ${ex.name}`} accessibilityState={{ expanded: expanded === ex.exerciseId, disabled }} disabled={disabled} onPress={() => setExpanded(expanded === ex.exerciseId ? null : ex.exerciseId)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{ex.name}</Text>
          <Text style={{ color: colors.foreground, fontSize: 13, lineHeight: 20 }}>{ex.setTargets!.map(set => set.durationSeconds != null ? `${set.durationSeconds} с` : `${formatKg(set.weightKg)} × ${set.reps}`).join(" · ")}</Text>
          {ex.calibration ? <Text style={{ color: colors.success, fontSize: 12 }}>Первый подход — подбор нагрузки</Text> : null}
        </View>
        <Feather name={expanded === ex.exerciseId ? "chevron-up" : "sliders"} size={19} color={colors.mutedForeground} />
      </Pressable>
      {expanded === ex.exerciseId ? <View style={{ gap: 14 }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{ex.note}</Text>
        <Stepper label={`Подходы: ${ex.name}`} unit="" value={ex.setTargets!.length} min={1} max={6} step={1} chips={[]} disabled={disabled} onChange={count => update(index, Array.from({ length: count }, (_, i) => ({ ...(ex.setTargets![i] ?? ex.setTargets!.at(-1)!) })))} />
        {ex.setTargets!.map((set, i) => {
          const change = (values: Partial<SetTarget>) => update(index, ex.setTargets!.map((target, n) => n === i ? { ...target, ...values } : target));
          return <View key={i} style={{ gap: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Подход {i + 1}</Text>
            {set.durationSeconds == null ? <Stepper label={`${ex.name}, подход ${i + 1}: ${weightLabel(ex.equipment)}`} value={set.weightKg} min={minimumWeight(ex.equipment)} max={2000} step={2.5} chips={[]} disabled={disabled} onChange={weightKg => change({ weightKg })} /> : null}
            <Stepper label={set.durationSeconds == null ? "Повторения" : "Удержание"} unit={set.durationSeconds == null ? "" : "с"} value={set.durationSeconds ?? set.reps} min={1} max={set.durationSeconds == null ? 100 : 86400} step={set.durationSeconds == null ? 1 : 5} chips={[]} disabled={disabled} onChange={value => change(set.durationSeconds == null ? { reps: value } : { durationSeconds: value })} />
          </View>;
        })}
      </View> : null}
    </View>)}
  </View>;
}
