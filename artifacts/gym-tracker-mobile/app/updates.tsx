import Feather from "@expo/vector-icons/Feather";
import { useGetActiveWorkout } from "@workspace/api-client-react";
import * as Updates from "expo-updates";
import { useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useReleaseNotes } from "@/components/ReleaseNotes";
import { useColors } from "@/hooks/useColors";
import { coachRequest } from "@/lib/coachApi";
import { exportProgress } from "@/lib/progressBackup";
import release from "@/release.json";

export default function UpdatesScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets();
  const active = useGetActiveWorkout();
  const openReleaseNotes = useReleaseNotes();
  const updates = Updates.useUpdates();
  const [busy, setBusy] = useState(false);
  const [downloaded, setReady] = useState(false);
  const ready = downloaded || updates.isUpdatePending;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); } catch { setError("Не удалось обновить приложение. Проверьте интернет и повторите попытку."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScreenHeader title="Обновления" />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: Math.max(insets.bottom, 16) }}>
      <Text style={{ color: colors.foreground, fontSize: 18, fontFamily: "Inter_700Bold" }}>Gym-Beam {release.displayVersion ?? release.version}</Text>
      <Text selectable style={{ color: colors.mutedForeground, fontSize: 12 }}>{Updates.isEmbeddedLaunch ? "Встроенная версия" : `Обновление ${Updates.updateId?.slice(0, 8) ?? "—"}`}</Text>
      <Button title="Что нового" variant="secondary" icon={<Feather name="file-text" size={18} color={colors.foreground} />} onPress={openReleaseNotes} />
      {!Updates.isEnabled ? <Text style={{ color: colors.amber, fontSize: 14 }}>Обновления доступны в установленном APK, не в режиме разработки.</Text> : <>
        <Button title="Проверить обновления" icon={<Feather name="refresh-cw" size={18} color={colors.primaryForeground} />} loading={busy} disabled={busy} onPress={() => { void run(async () => {
          setMessage("Проверка обновлений...");
          const pending = await Updates.checkForUpdateAsync();
          if (!pending.isAvailable) { setMessage(ready ? "Обновление загружено" : "Установлена актуальная версия"); return; }
          setMessage("Загрузка обновления...");
          const downloaded = await Updates.fetchUpdateAsync();
          setReady(downloaded.isNew);
          setMessage(downloaded.isNew ? "Обновление загружено" : "Установлена актуальная версия");
        }); }} />
        {ready ? <Button title="Применить обновление" disabled={busy || active.isPending || active.isError || !!active.data?.workout} icon={<Feather name="check-circle" size={18} color={colors.primaryForeground} />} onPress={() => { void run(async () => {
          const current = await coachRequest<{ workout: unknown | null }>("/api/workouts/active");
          if (current.workout) { setMessage("Сначала завершите текущую тренировку."); return; }
          await exportProgress();
          await Updates.reloadAsync();
        }); }} /> : null}
        {ready && active.data?.workout ? <Text style={{ color: colors.amber, fontSize: 14 }}>Сначала завершите текущую тренировку.</Text> : null}
      </>}
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 14 }}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.amber, fontSize: 14 }}>{error}</Text> : null}
    </ScrollView>
  </View>;
}
