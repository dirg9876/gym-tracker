import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { chooseAutomaticBackupFolder, getAutomaticBackupSettings, runAutomaticBackup, type AutomaticBackupResult } from "@/lib/automaticBackup";
import { formatDate } from "@/lib/format";
import { useColors } from "@/hooks/useColors";
import { Button } from "./Button";

export function AutomaticWorkoutBackup() {
  const colors = useColors(), router = useRouter(), lock = useRef(false), mounted = useRef(true);
  const [result, setResult] = useState<(AutomaticBackupResult & { lastExport?: string | null }) | null>(null), [busy, setBusy] = useState(false);
  const run = async (chooseFolder = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (chooseFolder) await chooseAutomaticBackupFolder();
      const next = await runAutomaticBackup(chooseFolder);
      const lastExport = next.kind === "idle" ? (await getAutomaticBackupSettings()).lastExport : null;
      if (mounted.current) setResult({ ...next, lastExport });
    } catch (error) {
      if (mounted.current && !/cancelled|canceled/i.test(String(error))) setResult({ kind: "failed", message: "Проверьте папку резервных копий." });
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => { mounted.current = true; void run(); return () => { mounted.current = false; }; }, []);
  const warning = result?.kind === "needs-folder" || result?.kind === "failed";
  const message = !result ? "Проверка автокопии..." : result.kind === "saved" ? "Автокопия создана" : result.kind === "needs-folder" ? "Автокопия: папка не выбрана" : result.kind === "failed" ? "Не удалось создать автокопию" : result.kind === "disabled" ? "Автокопия выключена" : result.lastExport && Number.isFinite(Date.parse(result.lastExport)) ? `Последняя автокопия: ${formatDate(result.lastExport)}` : "Автокопия пока не создана";
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>{busy ? <ActivityIndicator size="small" color={colors.accent} /> : <Feather name={warning ? "alert-circle" : result?.kind === "saved" ? "check-circle" : "hard-drive"} size={16} color={warning ? colors.amber : result?.kind === "saved" ? colors.success : colors.mutedForeground} />}<Text accessibilityLiveRegion="polite" style={{ flex: 1, color: warning ? colors.amber : colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>{message}</Text></View>
    {warning ? <View style={{ gap: 8 }}><Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>Записи в приложении сохранены. Внешняя копия пока не создана.</Text><Button title={result?.kind === "needs-folder" ? "Выбрать папку автокопий" : "Повторить автокопию"} variant="secondary" disabled={busy} icon={<Feather name={result?.kind === "needs-folder" ? "folder" : "refresh-cw"} size={17} color={colors.foreground} />} onPress={() => { void run(result?.kind === "needs-folder"); }} /></View> : null}
    {result?.kind === "disabled" || result?.kind === "failed" || result?.kind === "idle" ? <Button title="Резервная копия" variant="ghost" disabled={busy} icon={<Feather name="hard-drive" size={16} color={colors.foreground} />} onPress={() => router.push("/backup")} /> : null}
  </View>;
}
