import Feather from "@expo/vector-icons/Feather";
import { COACH_EVIDENCE } from "@workspace/ai-coach";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function TrainingBasis() {
  const colors = useColors(), [expanded, setExpanded] = useState(false);
  const body = { color: colors.mutedForeground, fontSize: 13, lineHeight: 20 };
  return <View style={{ borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 8, gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Основания расчёта" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Feather name="book-open" size={18} color={colors.accent} />
      <Text style={{ ...body, color: colors.foreground, flex: 1, fontFamily: "Inter_600SemiBold" }}>Основания расчёта</Text>
      <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
    </Pressable>
    {expanded ? <>
      <Text style={body}>Для цели «Мышцы»: основные движения 8–12, изоляция 10–15 повторений, целевой запас 2. IUSCA допускает рост мышц в широком диапазоне нагрузок. Эти границы — выбранная схема прогрессии, не биологический предел.</Text>
      <Text style={body}>Вес: оценка 1ПМ = вес × (1 + (повторы + RIR) / 30). Расчётный вес = оценка 1ПМ / (1 + (целевые повторы + RIR + поправка утомления) / 30), с округлением вниз по шагу оборудования и ограничением правилами прогрессии.</Text>
      <Text style={body}>Для формулы нужны сопоставимые подходы на 2–10 повторений, RIR 0–3 и сохранённая техника. Оценка сглаживается по занятиям; после 28 дней без измерений нужна проверка. Это приближённая модель, не измерение максимума или восстановления. Для собственного веса, секунд, противовеса и категории «Другое» формула не применяется.</Text>
      <Text style={body}>На верхней границе повторения не растут. Для прибавки нужны два полных сопоставимых занятия с запасом и техникой либо полный верх диапазона с большим запасом. Внутри занятия большой запас также меняет следующую цель. Прибавка учитывает шаг упражнения; слишком крупный шаг не применяется автоматически. После повышения веса повторы возвращаются к нижней границе. Неизвестный вес сначала проверяется одним подходом. Это правила приложения, не точный индивидуальный протокол из статьи.</Text>
      {COACH_EVIDENCE.sources.map(source => <Pressable key={source.url} accessibilityRole="link" onPress={() => { void Linking.openURL(source.url); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="external-link" size={15} color={colors.accent} /><Text style={{ ...body, color: colors.accent, flex: 1 }}>{source.title}</Text>
      </Pressable>)}
    </> : null}
  </View>;
}
