import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, View } from "react-native";
import { Button } from "./Button";
import { useColors } from "@/hooks/useColors";
import { chooseAutomaticBackupFolder, getAutomaticBackupSettings, runAutomaticBackup, setAutomaticBackupEnabled, type AutomaticBackupSettings as Settings } from "@/lib/automaticBackup";

export function AutomaticBackupSettings() {
  const colors = useColors();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refresh = async () => {
    try { setSettings(await getAutomaticBackupSettings()); setLoadError(null); }
    catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось прочитать настройки автокопии.");
      throw error;
    }
  };
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try { await action(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Повторите попытку.";
      if (!/cancelled|canceled/i.test(message)) Alert.alert("Автокопия", /unregistered ActivityResultLauncher/i.test(message) ? "Закройте и снова откройте приложение, затем выберите папку." : message);
    } finally { await refresh().catch(() => {}); setBusy(false); }
  };
  const exportNow = async () => {
    const result = await runAutomaticBackup(true);
    if (result.kind === "failed") Alert.alert("Не удалось создать автокопию", "Прогресс в приложении сохранён. Проверьте доступ к папке и свободное место.");
  };
  useEffect(() => { refresh().catch(() => {}); }, []);
  if (!settings) return loadError ? <View style={{ gap: 12 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 13 }}>{loadError}</Text>
    <Button title="Повторить загрузку автокопии" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void perform(refresh); }} disabled={busy} loading={busy} />
  </View> : <ActivityIndicator color={colors.primary} />;
  return <View style={{ gap: 12, borderTopWidth: 1, borderColor: colors.cardBorder, paddingTop: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ flex: 1, color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Автокопия после тренировки</Text>
      <Switch accessibilityLabel="Автокопия после тренировки" value={settings.enabled} disabled={busy} trackColor={{ true: colors.primary, false: colors.muted }} onValueChange={enabled => { perform(async () => { await setAutomaticBackupEnabled(enabled); if (enabled) await runAutomaticBackup(); }); }} />
    </View>
    <Text style={{ color: settings.folderUri ? colors.mutedForeground : colors.amber, fontSize: 13 }}>{settings.folderUri ? decodeURIComponent(settings.folderUri).split("/").pop()?.replace(/^primary:/, "") : "Папка не выбрана"}</Text>
    <Button title={settings.folderUri ? "Изменить папку автокопий" : "Выбрать папку автокопий"} variant="secondary" icon={<Feather name="folder" size={18} color={colors.foreground} />} disabled={busy} onPress={() => { perform(async () => { await chooseAutomaticBackupFolder(); await exportNow(); }); }} />
    {settings.lastExport ? <Text style={{ color: colors.success, fontSize: 13 }}>Последняя автокопия: {new Date(settings.lastExport).toLocaleString("ru-RU")}</Text> : null}
    {settings.lastError ? <Text style={{ color: colors.destructive, fontSize: 13 }}>Автокопия не записана. Проверьте папку и свободное место.</Text> : null}
    {settings.pending.length ? <Text style={{ color: colors.amber, fontSize: 13 }}>Ожидают копирования: {settings.pending.length}</Text> : null}
    {settings.enabled && settings.folderUri ? <Button title="Создать копию сейчас" variant="ghost" icon={<Feather name="download" size={18} color={colors.foreground} />} disabled={busy} onPress={() => { perform(exportNow); }} /> : null}
    {busy ? <ActivityIndicator color={colors.primary} /> : null}
  </View>;
}
