import { Text, View } from "react-native";
import type { StructuredReview, TrainingAnalysis } from "@workspace/ai-coach";
import { useColors } from "@/hooks/useColors";
import { formatAnalysisResult } from "@/lib/trainingAnalysis";

export function CoachReview({ review, analysis }: { review: StructuredReview; analysis: TrainingAnalysis }) {
  const colors = useColors();
  const body = { color: colors.foreground, fontSize: 14, lineHeight: 22 };
  const muted = { color: colors.mutedForeground, fontSize: 13, lineHeight: 20 };
  const title = { color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold" };
  return <View style={{ gap: 20 }}>
    <View style={{ gap: 8 }}><Text style={title}>Вывод тренера</Text><Text style={body}>{review.overview}</Text></View>
    {review.progress.length ? <View style={{ gap: 14 }}><Text style={title}>По упражнениям</Text>{review.progress.map(row => {
      const evidence = analysis.exercises.find(ex => ex.key === row.exerciseKey)!;
      return <View key={row.exerciseKey} style={{ gap: 6 }}>
      <Text style={{ ...body, fontFamily: "Inter_600SemiBold" }}>{evidence.name}</Text>
      <Text style={body}>{row.observation}</Text><Text style={muted}>{row.interpretation}</Text>
      <Text style={{ ...body, color: colors.success }}>{row.action}</Text>
      {evidence.matchesCurrentCategory ? <Text style={{ ...body, fontFamily: "Inter_600SemiBold", color: colors.success }}>Следующий ориентир: {formatAnalysisResult(evidence, true)}</Text> : null}
    </View>; })}</View> : null}
    <View style={{ gap: 8 }}><Text style={title}>Баланс нагрузки</Text><Text style={body}>{review.workload}</Text></View>
    <View style={{ gap: 8 }}><Text style={title}>Запас и техника</Text><Text style={body}>{review.effort}</Text></View>
    <View style={{ gap: 12 }}><Text style={title}>Приоритеты</Text>{review.priorities.map((row, index) => <View key={index} style={{ gap: 6 }}><Text style={{ ...body, fontFamily: "Inter_600SemiBold" }}>{index + 1}. {row.title}</Text><Text style={{ ...body, color: colors.success }}>{row.action}</Text><Text style={muted}>{row.reason}</Text></View>)}</View>
    <View style={{ gap: 6 }}><Text style={title}>Что пока неизвестно</Text>{review.limitations.map((text, index) => <Text key={index} style={muted}>{text}</Text>)}</View>
  </View>;
}
