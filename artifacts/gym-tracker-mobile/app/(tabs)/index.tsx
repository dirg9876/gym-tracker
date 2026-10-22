import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { useGetActiveWorkout } from "@workspace/api-client-react";
import { Image } from "expo-image";
import { useRouter, type Href } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAiConnection } from "@/hooks/useAiCoach";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { ProgressRecoveryRequired } from "@/lib/progressStorage";
import { coachRequest } from "@/lib/coachApi";
import type { ExerciseMaintenance } from "@/lib/exerciseReplacement";

// Repacked APKs store new artwork as a raw asset; EAS bundles it normally.
const logo = process.env.EXPO_PUBLIC_GYM_REPACK_ASSETS === "1"
  ? { uri: "file:///android_asset/branding/gymbeam-logo.png" }
  : require("../../../gym-tracker/src/assets/gymbeam-logo.png");

export default function BrandScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [artworkSize, setArtworkSize] = useState(0);
  const toast = useToast();
  const active = useGetActiveWorkout();
  const maintenance = useQuery({ queryKey: ["exercise-maintenance"], queryFn: () => coachRequest<ExerciseMaintenance[]>("/api/exercises/maintenance") });
  const pendingReplacements = maintenance.data?.filter(row => row.exercise.replacementPending).length ?? 0;
  const connection = useAiConnection();
  const aiEnabled = !!connection.data?.enabled;
  const workout = active.data?.workout;
  const start = () => {
    if (active.isPending || active.isError) return;
    if (workout) router.push(`/workout/${workout.id}`);
    else router.push("/start-workout" as Href);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={`ИИ-тренер: ${aiEnabled ? "включён" : "выключен"}`} onPress={() => router.push("/coach")} onLongPress={() => toast.show("info", `ИИ-тренер ${aiEnabled ? "включён" : "выключен"}`)} style={[styles.coach, { borderColor: aiEnabled ? colors.successBorder : colors.cardBorder, backgroundColor: aiEnabled ? colors.successSoft : colors.card }]}><Feather name="zap" size={19} color={aiEnabled ? colors.success : colors.mutedForeground} /><Text style={{ color: aiEnabled ? colors.success : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>ИИ-тренер</Text></Pressable>
        <View style={{ flexDirection: "row", gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Обновления приложения" onPress={() => router.push("/updates")} onLongPress={() => toast.show("info", "Обновления приложения")} style={styles.backup}><Feather name="download-cloud" size={21} color={colors.accent} /></Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Резервная копия"
          onPress={() => router.push("/backup")}
          onLongPress={() => toast.show("info", "Резервная копия")}
          style={({ pressed }) => [styles.backup, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Feather name="hard-drive" size={21} color={colors.mutedForeground} />
        </Pressable>
        </View>
      </View>
      <View style={styles.artwork} onLayout={({ nativeEvent: { layout } }) => {
        setArtworkSize(Math.max(0, Math.min(layout.width - 32, (layout.height - 112) * 1254 / 880, 440)));
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
        <Text accessibilityLabel="Gym-Beam" adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.wordmark}>GYM-<Text style={{ color: colors.primary }}>BEAM</Text></Text>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 4, height: 5, marginTop: 4 }}><View style={{ width: 56, backgroundColor: colors.accent }} /><View style={{ width: 24, backgroundColor: colors.accent }} /><View style={{ width: 8, backgroundColor: colors.primary }} /></View>
      </View>
      <View style={styles.commands}>
        {pendingReplacements ? <Button title={`Выбрать замену упражнений: ${pendingReplacements}`} variant="secondary" icon={<Feather name="repeat" size={18} color={colors.accent} />} onPress={() => router.push("/exercises")} /> : null}
        <Button
          title={workout ? "Продолжить тренировку" : "Начать тренировку"}
          size="lg"
          loading={active.isPending}
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
  coach: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderRadius: 6 },
  backup: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  artwork: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  commands: { width: "100%", maxWidth: 480, alignSelf: "center", paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  activeCaption: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", textAlign: "center" },
  wordmark: { fontSize: 42, lineHeight: 56, fontFamily: "Inter_900Black_Italic", color: "#F4F6F8", textAlign: "center", maxWidth: "90%", marginTop: 16, paddingHorizontal: 8 },
});
