import Feather from "@expo/vector-icons/Feather";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { CoachContext, CoachEnvelope, CoachTask } from "@workspace/ai-coach";
import { useAiCoach } from "@/hooks/useAiCoach";
import { useColors } from "@/hooks/useColors";
import { setCoachProposal } from "@/lib/aiCoachPlan";
import { Button } from "./Button";
import { CoachReview } from "./CoachReview";

export function AiCoachPanel({ task, workoutId, contextKey, disabled, onApplySet }: { task: CoachTask; workoutId?: number; contextKey?: string; disabled?: boolean; onApplySet?: (answer: CoachEnvelope, context: CoachContext) => Promise<void> }) {
  const coach = useAiCoach(task, workoutId, contextKey);
  const colors = useColors();
  const router = useRouter();
  if (!coach.enabled) return null;
  const reply = coach.answer?.envelope.result;
  const set = reply?.nextSet;
  return <View style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.cardBorder }}>
    <Button title={task === "next_set" ? "Совет для следующего подхода" : task === "review" ? "Разбор тренировки" : "Следующая тренировка с ИИ"} variant="secondary" icon={<Feather name="zap" size={18} color={colors.success} />} onPress={() => { void coach.ask(); }} loading={coach.busy} disabled={disabled || coach.busy} />
    {coach.error ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 13 }}>{coach.error}</Text> : null}
    {reply ? <>
      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>ИИ · {coach.answer!.envelope.model}</Text>
      {"review" in reply && reply.review && coach.answer!.context.analysis ? <CoachReview review={reply.review} analysis={coach.answer!.context.analysis} /> : <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 21 }}>{reply.summary}</Text>}
      {reply.cautions.map((text, i) => <Text key={i} style={{ color: colors.amber, fontSize: 13 }}>{text}</Text>)}
      {set ? <Text style={{ color: colors.success, fontSize: 16, fontFamily: "Inter_700Bold" }}>{set.durationSeconds != null ? `${set.durationSeconds} с` : `${set.weightKg?.toLocaleString("ru-RU")} кг × ${set.reps}`}{"\n"}<Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{set.reason}</Text></Text> : null}
      {set && onApplySet ? <Button title="Применить к черновику" icon={<Feather name="check" size={18} color={colors.primaryForeground} />} disabled={disabled || coach.busy} onPress={() => { void coach.apply(onApplySet); }} /> : null}
      {reply.plan ? <Button title="Открыть предложенный план" icon={<Feather name="edit-2" size={18} color={colors.primaryForeground} />} disabled={disabled || coach.busy} onPress={() => { void coach.apply(async (answer, context) => { setCoachProposal(answer.result, context); router.push("/coach-plan"); }); }} /> : null}
    </> : null}
  </View>;
}
