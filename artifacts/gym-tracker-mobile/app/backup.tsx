import Feather from "@expo/vector-icons/Feather";
import { useQueryClient } from "@tanstack/react-query";
import { Directory, File } from "expo-file-system";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AutomaticBackupSettings } from "@/components/AutomaticBackupSettings";
import { returnToBrand } from "@/lib/navigation";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { formatNumber } from "@/lib/format";
import {
  exportProgress, getBackupStatus, MAX_BACKUP_BYTES, parseProgressBackup,
  recordSuccessfulExport, restoreProgress, type ProgressBackup,
} from "@/lib/progressBackup";

type Preview = { text: string; backup: ProgressBackup; name: string };

export default function BackupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<ProgressBackup | null>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getBackupStatus>> | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Не удалось выполнить операцию.";
    if (/cancelled|canceled/i.test(message)) return;
    if (/unregistered ActivityResultLauncher/i.test(message)) {
      Alert.alert("Не удалось открыть выбор файла", "После изменения конфигурации экрана закройте и снова откройте приложение. Прогресс не изменён.");
      return;
    }
    Alert.alert("Резервная копия", message);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const backup = await parseProgressBackup(await exportProgress());
        if (mounted) setCurrent(backup);
      } catch (error) {
        if (mounted) setLoadError(error instanceof Error ? error.message : "Не удалось прочитать прогресс.");
      }
      try { const next = await getBackupStatus(); if (mounted) setStatus(next); }
      catch (error) { if (mounted) showError(error); }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const saveDamagedData = async () => {
    if (!status?.quarantine) return;
    setBusy(true);
    try {
      const directory = await Directory.pickDirectoryAsync();
      const filename = `gym-tracker-damaged-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      const file = directory.createFile(filename, "application/json");
      file.write(status.quarantine);
      if (await file.text() !== status.quarantine) throw new Error("Не удалось проверить записанный архив.");
      Alert.alert("Исходные данные сохранены", filename);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  const saveFile = async () => {
    setBusy(true);
    try {
      const directory = await Directory.pickDirectoryAsync();
      const text = await exportProgress();
      const backup = await parseProgressBackup(text);
      const filename = `gym-tracker-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
      const file = directory.createFile(filename, "application/json");
      try {
        file.write(text);
        if ((await parseProgressBackup(await file.text())).checksum !== backup.checksum) throw new Error("Записанная копия не совпадает с исходными данными.");
      } catch (error) {
        try { file.delete(); } catch { /* The folder may no longer permit cleanup. */ }
        throw error;
      }
      await recordSuccessfulExport(backup.exportedAt);
      setStatus(await getBackupStatus());
      setCurrent(backup);
      Alert.alert("Копия сохранена", filename);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  const pickFile = async () => {
    setBusy(true);
    try {
      const selected = await File.pickFileAsync(undefined, "*/*");
      const picked = Array.isArray(selected) ? selected[0] : selected;
      if (!picked) return;
      const file = new File(picked.uri);
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Файл слишком большой: максимум 25 МБ.");
      const text = await file.text();
      const backup = await parseProgressBackup(text);
      setPreview({ text, backup, name: file.name });
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      await restoreProgress(preview.text);
      queryClient.clear();
      setPreview(null);
      toast.show("success", "Прогресс восстановлен");
      returnToBrand();
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  const undo = async () => {
    if (!status?.recovery) return;
    setBusy(true);
    try {
      const backup = await parseProgressBackup(status.recovery);
      setPreview({ text: status.recovery, backup, name: "Предыдущая копия прогресса" });
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Резервная копия" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 24 }}>
        <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: "Inter_700Bold" }}>На устройстве</Text>
        {current ? <BackupSummary backup={current} /> : loadError ? <Text accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 14 }}>{loadError}</Text> : <ActivityIndicator color={colors.primary} />}
        <View style={{ gap: 12 }}>
          <Button title="Экспорт в файл" icon={<Feather name="download" size={20} color={colors.primaryForeground} />} onPress={saveFile} disabled={busy || !current} />
          <Button title="Импорт из файла" icon={<Feather name="upload" size={20} color={colors.foreground} />} variant="secondary" onPress={pickFile} disabled={busy} />
        </View>
        {status?.quarantine ? <View style={{ gap: 12 }}><Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Повреждённые исходные данные сохранены отдельно.</Text><Button title="Сохранить повреждённые данные" variant="secondary" icon={<Feather name="download" size={18} color={colors.foreground} />} onPress={saveDamagedData} disabled={busy} /></View> : null}
        <AutomaticBackupSettings />
        <View style={{ borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 20, gap: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Последний экспорт</Text>
          <Text style={{ color: colors.foreground, fontSize: 15 }}>{status?.lastExport ? new Date(status.lastExport).toLocaleString("ru-RU") : "Копия ещё не создана"}</Text>
        </View>
        {status?.recovery ? <Button title="Предыдущая копия прогресса" variant="ghost" icon={<Feather name="rotate-ccw" size={18} color={colors.foreground} />} onPress={undo} disabled={busy} /> : null}
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </ScrollView>
      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setPreview(null); }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: 20, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }}>
          <ScrollView style={{ flexGrow: 0, width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: colors.card, borderRadius: 8 }} contentContainerStyle={{ padding: 20, gap: 18 }}>
            <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: "Inter_700Bold" }}>Восстановить прогресс?</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{preview?.name}</Text>
            {preview ? <>
              <Text style={{ color: colors.foreground, fontSize: 14 }}>{new Date(preview.backup.exportedAt).toLocaleString("ru-RU")}</Text>
              <BackupSummary backup={preview.backup} />
            </> : null}
            <Text style={{ color: colors.amber, fontSize: 14 }}>Данные будут заменены. Исходные записи сохранятся отдельно.</Text>
            <Button title="Заменить данные" onPress={restore} loading={busy} />
            <Button title="Отмена" variant="secondary" onPress={() => setPreview(null)} disabled={busy} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function BackupSummary({ backup }: { backup: ProgressBackup }) {
  const colors = useColors();
  const { state, plans } = backup;
  const rows = [
    ["Завершённые тренировки", state.workouts.filter((workout) => workout.finishedAt).length],
    ["Текущая тренировка", state.workouts.filter((workout) => !workout.finishedAt).length],
    ["Подходы", state.sets.length],
    ["Упражнения", state.exercises.filter(exercise => !exercise.deletedAt).length],
    ["Удалённые упражнения в истории", state.exercises.filter(exercise => exercise.deletedAt).length],
    ["Свои программы", state.customPrograms.length],
    ["Планы тренировок", Object.keys(plans).length],
    ["Сохранённый уровень", state.confirmedLevel],
  ] as const;
  return <View style={{ gap: 12 }}>{rows.map(([label, value]) => (
    <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.mutedForeground, fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>{formatNumber(value)}</Text>
    </View>
  ))}</View>;
}
