import { useEffect } from "react";
import { Alert } from "react-native";
import { chooseAutomaticBackupFolder, runAutomaticBackup } from "@/lib/automaticBackup";

export function AutomaticWorkoutBackup() {
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const result = await runAutomaticBackup();
      if (!mounted) return;
      if (result.kind === "failed") Alert.alert("Автокопия не создана", "Тренировка сохранена в приложении. Проверьте папку и свободное место в разделе резервной копии.");
      if (result.kind === "needs-folder") Alert.alert("Папка для автокопий", "Выберите папку один раз. После каждой завершённой тренировки в ней будет сохраняться копия всего прогресса.", [
        { text: "Позже", style: "cancel" },
        { text: "Выбрать папку", onPress: async () => {
          try {
            await chooseAutomaticBackupFolder();
            const saved = await runAutomaticBackup(true);
            if (saved.kind === "failed") Alert.alert("Автокопия не создана", "Прогресс в приложении сохранён. Проверьте папку в разделе резервной копии.");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Повторите попытку.";
            if (!/cancelled|canceled/i.test(message)) Alert.alert("Автокопия", /unregistered ActivityResultLauncher/i.test(message) ? "Закройте и снова откройте приложение, затем выберите папку в разделе резервной копии." : message);
          }
        } },
      ]);
    };
    run().catch(() => {});
    return () => { mounted = false; };
  }, []);
  return null;
}
