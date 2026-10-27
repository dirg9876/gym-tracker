import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { ModelForecast as Forecast } from "@workspace/ai-coach";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";

export function ModelForecast({ model, perDumbbell = false }: { model: Forecast; perDumbbell?: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const muted = { color: colors.mutedForeground, fontSize: 12, lineHeight: 19 };
  return <View style={{ gap: 6 }}>
    {model.status === "ready" ? <Pressable accessibilityRole="button" accessibilityLabel="Прогноз и точность" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ ...muted, flex: 1 }}>Прогноз и точность</Text><Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} /></Pressable> : null}
    {model.status !== "ready" || expanded ? <>
    {model.status === "ready" ? <>
      <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Оценочный 1ПМ: {formatNumber(model.estimated1RMKg!)} кг{perDumbbell ? " на гантель" : ""}{model.source === "today" ? " · по подходу сегодня" : ` · занятий: ${model.sessions}`}</Text>
      {model.unroundedWeightKg != null ? <Text style={muted}>Расчётный вес при RIR {model.targetRir}: {formatNumber(model.unroundedWeightKg)} кг до округления и ограничений прогрессии.</Text> : null}
      {model.predictedReps != null ? <Text style={muted}>Математическая оценка, не цель подхода: около {formatNumber(model.predictedReps)} повт. с RIR {model.targetRir}. Назначение ограничено диапазоном упражнения.</Text> : null}
      <Text style={muted}>{model.validationSamples ? `Проверка EMA-тренда на последующих занятиях: ${model.validationSamples} · средняя ошибка ${formatNumber(model.repErrorMAE!)} повт. при записанном RIR, не точность назначений.` : "Ещё нет последующих занятий для проверки ошибки тренда."}</Text>
      <Text style={muted}>{model.fatigueBeta == null ? "Коэффициент утомления ещё не определён." : `Поправка на подход: ${formatNumber(model.fatigueBeta)} повт. · сопоставлений: ${model.fatigueSamples}`}</Text>
    </> : null}
    <Text style={muted}>{model.note}</Text>
    </> : null}
  </View>;
}
