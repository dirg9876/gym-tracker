import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { getGetActiveWorkoutQueryKey, getListWorkoutsQueryKey, useCreateWorkout, useGetActiveWorkout } from "@workspace/api-client-react";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAiConnection } from "@/hooks/useAiCoach";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { ProgressRecoveryRequired } from "@/lib/progressStorage";

// Repacked APKs store new artwork as a raw asset; EAS bundles it normally.
const logo = process.env.EXPO_PUBLIC_GYM_REPACK_ASSETS === "1"
  ? { uri: "file:///android_asset/branding/gymbeam-logo.png" }
  : require("../../../gym-tracker/src/assets/gymbeam-logo.png");

export default function BrandScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [artworkSize, setArtworkSize] = useState(0);
  const queryClient = useQueryClient();
  const toast = useToast();
  const active = useGetActiveWorkout();
  const connection = useAiConnection();
  const aiEnabled = !!connection.data?.enabled;
  const workout = active.data?.workout;
  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: (created) => {
        queryClient.setQueryData(getGetActiveWorkoutQueryKey(), { workout: created });
        void queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
        router.push(`/workout/${created.id}`);
      },
      onError: () => toast.show("error", "Не удалось начать тренировку", "Попробуйте ещё раз"),
    },
  });

  const start = () => {
    if (active.isPending || active.isError || createWorkout.isPending) return;
    if (workout) router.push(`/workout/${workout.id}`);
    else createWorkout.mutate({ data: {} });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={`ИИ-тренер: ${aiEnabled ? "включён" : "выключен"}`} onPress={() => router.push("/coach")} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="zap" size={23} color={aiEnabled ? colors.success : colors.mutedForeground} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Обновления приложения" onPress={() => router.push("/updates")} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Feather name="download-cloud" size={23} color={colors.mutedForeground} /></Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Резервная копия"
          onPress={() => router.push("/backup")}
          style={({ pressed }) => [styles.backup, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="hard-drive" size={23} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={styles.artwork} onLayout={({ nativeEvent: { layout } }) => {
        setArtworkSize(Math.max(0, Math.min(layout.width - 32, (layout.height - 100) * 1254 / 880, 480)));
      }}>
        <View style={{ width: artworkSize, height: artworkSize * 880 / 1254, overflow: "hidden" }}>
          <Image
            source={logo}
            accessibilityLabel="Стакан со штангой"
            accessible
            contentFit="contain"
            style={{ width: artworkSize, height: artworkSize }}
          />
        </View>
        <Text accessibilityLabel="Gym-Beam" style={styles.wordmark} adjustsFontSizeToFit numberOfLines={1}>
          GYM-<Text style={{ color: "#FF8A1F" }}>BEAM</Text>
        </Text>
      </View>
      <View style={styles.commands}>
        {aiEnabled ? <Button title={workout ? "Продолжить с ИИ-тренером" : "Начать тренировку с ИИ"} size="lg" variant="secondary" icon={<Feather name="zap" size={21} color={colors.success} />} disabled={active.isPending || active.isError || createWorkout.isPending} onPress={() => router.push(workout ? `/coach-session?workoutId=${workout.id}` : "/coach-session")} /> : null}
        <Button
          title={workout ? "Продолжить тренировку" : "Начать тренировку"}
          size="lg"
          loading={active.isPending || createWorkout.isPending}
          disabled={active.isError}
          icon={<Feather name={workout ? "activity" : "play"} size={21} color={colors.primaryForeground} />}
          onPress={start}
        />
        {workout ? <Text style={[styles.activeCaption, { color: colors.mutedForeground }]} numberOfLines={2}>{workout.name || "Текущая тренировка"} · {workout.totalSets} подх.</Text> : null}
        {active.isError ? active.error instanceof ProgressRecoveryRequired ? <Button title="Восстановить прогресс" variant="secondary" icon={<Feather name="hard-drive" size={18} color={colors.foreground} />} onPress={() => router.push("/backup")} /> : <Button title="Повторить загрузку тренировки" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void active.refetch(); }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  toolbar: { height: 56, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backup: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  artwork: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 24, gap: 16 },
  commands: { width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  activeCaption: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", textAlign: "center" },
  wordmark: { color: "#FFFFFF", fontSize: 36, lineHeight: 46, fontFamily: "Inter_700Bold", fontStyle: "italic", textAlign: "center", maxWidth: "90%" },
});
