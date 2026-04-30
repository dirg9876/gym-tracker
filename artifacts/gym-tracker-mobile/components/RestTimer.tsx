import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";

const PRESETS = [60, 90, 120, 180];

type Props = {
  defaultSeconds?: number;
};

function formatPreset(seconds: number): string {
  if (seconds < 60) return `${seconds}с`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}м ${rest}с` : `${minutes}м`;
}

export function RestTimer({ defaultSeconds = 90 }: Props) {
  const colors = useColors();
  const [target, setTarget] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          if (!firedRef.current) {
            firedRef.current = true;
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = (seconds: number) => {
    setTarget(seconds);
    setRemaining(seconds);
    setRunning(true);
    firedRef.current = false;
  };

  const reset = () => {
    setRunning(false);
    setRemaining(0);
    firedRef.current = false;
  };

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = target > 0 ? Math.max(0, Math.min(100, 100 - (remaining / target) * 100)) : 0;
  const isDone = running && remaining === 0;

  return (
    <Card padding={16}>
      <View style={{ gap: 12 }}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Feather name="bell" size={14} color={colors.mutedForeground} />
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Отдых между подходами
            </Text>
          </View>
          {running ? (
            <Pressable onPress={reset} hitSlop={10}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        {running ? (
          <View style={{ gap: 12 }}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={[styles.timer, { color: isDone ? colors.primary : colors.foreground }]}
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.muted }]}>
              <View style={[styles.fill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
            </View>
            <View style={styles.controls}>
              <TimerButton label="+15с" onPress={() => setRemaining((r) => r + 15)} />
              <TimerIconButton
                icon={remaining > 0 && running ? "pause" : "play"}
                onPress={() => setRunning((r) => !r)}
              />
              <TimerIconButton icon="rotate-ccw" onPress={() => start(target)} />
            </View>
          </View>
        ) : (
          <View style={styles.presets}>
            {PRESETS.map((preset) => (
              <TimerButton
                key={preset}
                label={formatPreset(preset)}
                onPress={() => start(preset)}
              />
            ))}
          </View>
        )}
      </View>
    </Card>
  );
}

function TimerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.timerButton,
        { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.timerButtonText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function TimerIconButton({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  label: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  timer: { fontSize: 48, fontFamily: "Inter_700Bold", textAlign: "center" },
  track: { height: 7, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%" },
  controls: { flexDirection: "row", justifyContent: "center", gap: 8 },
  presets: { flexDirection: "row", gap: 8 },
  timerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  timerButtonText: { fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  iconButton: {
    width: 48,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
