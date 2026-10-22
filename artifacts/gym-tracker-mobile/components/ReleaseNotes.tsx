import Feather from "@expo/vector-icons/Feather";
import { useGetActiveWorkout } from "@workspace/api-client-react";
import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useToast } from "@/components/Toast";
import { useColors } from "@/hooks/useColors";
import { acknowledgeRelease, canShowReleaseNotes, hasUnreadRelease } from "@/lib/releaseNotes";
import release from "@/release.json";

const ReleaseNotesContext = createContext<(() => void) | null>(null);

export function useReleaseNotes() {
  const open = useContext(ReleaseNotesContext);
  if (!open) throw new Error("useReleaseNotes requires ReleaseNotesProvider");
  return open;
}

export function ReleaseNotesProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const active = useGetActiveWorkout();
  const { show } = useToast();
  const [unread, setUnread] = useState(false);
  const [visible, setVisible] = useState(false);
  const closing = useRef(false);
  const open = useCallback(() => setVisible(true), []);

  useEffect(() => {
    let mounted = true;
    hasUnreadRelease(release.version)
      .then(value => { if (mounted) setUnread(value); })
      .catch(() => { if (mounted) setUnread(true); });
    return () => { mounted = false; };
  }, []);

  const canShow = canShowReleaseNotes(path, active.isSuccess, !!active.data?.workout);
  useEffect(() => {
    if (unread && canShow) setVisible(true);
  }, [unread, canShow]);

  const close = async () => {
    if (closing.current) return;
    closing.current = true;
    try { await acknowledgeRelease(release.version); }
    catch { show("info", "Не удалось сохранить отметку", "Описание обновления может появиться при следующем запуске."); }
    finally {
      setUnread(false);
      setVisible(false);
      closing.current = false;
    }
  };

  const date = release.releasedAt.split("-").reverse().join(".");
  return <ReleaseNotesContext.Provider value={open}>
    {children}
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { void close(); }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>Что нового</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Gym-Beam {release.version} · {date}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть описание обновления" hitSlop={8} onPress={() => { void close(); }} style={styles.close}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.changes}>
            {release.changes.map(change => <View key={change} style={styles.change}>
              <Feather name="check" size={18} color={colors.success} style={{ marginTop: 2 }} />
              <Text style={[styles.description, { color: colors.foreground }]}>{change}</Text>
            </View>)}
          </ScrollView>
          <View style={styles.footer}>
            <Button title="Понятно" icon={<Feather name="check" size={18} color={colors.primaryForeground} />} onPress={() => { void close(); }} />
          </View>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  </ReleaseNotesContext.Provider>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.72)" },
  dialog: { width: "100%", maxWidth: 480, maxHeight: "100%", flexShrink: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, paddingBottom: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  changes: { paddingHorizontal: 20, paddingBottom: 8, gap: 18 },
  change: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  description: { flex: 1, fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular" },
  footer: { padding: 20, paddingTop: 16 },
});
