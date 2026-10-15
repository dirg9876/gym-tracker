import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteWorkout } from "@workspace/api-client-react";
import { Alert, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  workoutId: number;
  name: string;
  disabled?: boolean;
  onDeleted?: () => void;
  onPendingChange?: (pending: boolean) => void;
};

export function DeleteWorkoutButton({ workoutId, name, disabled, onDeleted, onPendingChange }: Props) {
  const colors = useColors();
  const client = useQueryClient();
  const remove = useDeleteWorkout({ mutation: {
    onMutate: () => onPendingChange?.(true),
    onSuccess: () => {
      onDeleted?.();
      client.removeQueries({ queryKey: ["finish-report", workoutId] });
      client.removeQueries({ queryKey: ["coach-timer", workoutId] });
      client.invalidateQueries();
    },
    onError: error => Alert.alert("Не удалось удалить", error instanceof Error ? error.message : "Повторите попытку."),
    onSettled: () => onPendingChange?.(false),
  } });
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Удалить тренировку: ${name}`}
    disabled={disabled || remove.isPending}
    onPress={event => {
      event.stopPropagation();
      Alert.alert("Удалить тренировку?", `${name}\nВсе подходы этой тренировки будут удалены. Статистика и уровни пересчитаются. Сохранённые виды тренировок останутся.`, [
        { text: "Отмена", style: "cancel" },
        { text: "Удалить", style: "destructive", onPress: () => remove.mutate({ workoutId }) },
      ]);
    }}
    style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled || remove.isPending ? 0.35 : pressed ? 0.6 : 1 })}
  ><Feather name="trash-2" size={20} color={colors.destructive} /></Pressable>;
}
