import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { progressRatio } from "@/lib/displayProgress";

export function ProgressTrack({ value, total, label, color, segmented = false }: {
  value: number; total: number; label: string; color?: string; segmented?: boolean;
}) {
  const colors = useColors();
  const ratio = progressRatio(value, total);
  const fill = color ?? colors.accent;
  const animated = useRef(new Animated.Value(ratio)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (mounted) setReduceMotion(enabled); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || segmented) { animated.setValue(ratio); return; }
    const animation = Animated.timing(animated, { toValue: ratio, duration: 160, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [animated, ratio, reduceMotion, segmented]);
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    style={{ height: segmented ? 8 : 4, flexDirection: "row", gap: 4, overflow: "hidden", backgroundColor: segmented ? "transparent" : colors.cardBorder }}>
    {segmented ? Array.from({ length: 16 }, (_, index) => <View key={index} style={{ flex: 1, height: 8, backgroundColor: colors.cardBorder, overflow: "hidden" }}>
      <View style={{ height: 8, width: `${Math.max(0, Math.min(1, ratio * 16 - index)) * 100}%`, backgroundColor: fill }} />
    </View>) : <Animated.View style={{ height: 4, backgroundColor: fill, width: animated.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />}
  </View>;
}
