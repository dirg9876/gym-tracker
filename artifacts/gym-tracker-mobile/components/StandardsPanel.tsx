import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { formatStandard, standardProgress, type ExerciseStandard } from "@/lib/exerciseStandards";

export function StandardsPanel({ standard, best }: { standard: ExerciseStandard; best: number }) {
  const colors = useColors();
  const progress = standardProgress(standard, best);
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" }}>{standard.official ? "Нормативы WRPF" : "Расчётные ориентиры"}</Text>
    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{best > 0 ? `Лучший подход: ${formatStandard(best, standard.unit)}` : "Ещё нет завершённых подходов"}</Text>
    {progress.current ? <Text style={{ color: colors.success, fontSize: 13 }}>{standard.official ? "Тренировочный результат не ниже норматива" : "Достигнут условный ориентир"}: {progress.current.rank.label}</Text> : null}
    {standard.official ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Запись в дневнике, не соревновательный протокол и не присвоенный разряд. Расчётный 1ПМ здесь не засчитывается.</Text> : null}
    {standard.entries.map(entry => {
      const passed = best >= entry.target;
      const next = !progress.atMaximum && progress.rank.code === entry.rank.code;
      return <View key={entry.rank.code} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6, backgroundColor: passed ? colors.successSoft : "transparent", borderWidth: next ? 1 : 0, borderColor: colors.cardBorder }}>
        <Feather name={passed ? "check-circle" : "circle"} size={16} color={passed ? colors.success : colors.mutedForeground} />
        <Text style={{ flex: 1, color: passed ? colors.success : colors.foreground, fontSize: 13 }}>{entry.rank.label}</Text>
        <View style={{ alignItems: "flex-end", gap: 3 }}>
          <Text style={{ color: passed ? colors.success : colors.foreground, fontSize: 13 }}>{formatStandard(entry.target, standard.unit)}</Text>
          {next ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Ещё {formatStandard(progress.remaining, standard.unit)}</Text> : null}
        </View>
      </View>;
    })}
    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{standard.description}</Text>
  </View>;
}
