import { useAssets } from "expo-asset";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { claimWorkoutCelebration } from "@/lib/workoutCelebration";

const logo = process.env.EXPO_PUBLIC_GYM_REPACK_ASSETS === "1" ? "file:///android_asset/branding/gymbeam-logo.png" : require("@/assets/images/gymbeam-logo.png");
const particles = Array.from({ length: 14 }, (_, index) => ({ x: Math.cos(index * Math.PI / 7) * (85 + index % 3 * 12), y: Math.sin(index * Math.PI / 7) * 40 - 12, rotate: index % 2 ? 150 : -150 }));

export function WorkoutCelebration({ workoutId, finishedAt, fresh }: { workoutId: number; finishedAt: string; fresh: boolean }) {
  const colors = useColors(), motion = useRef(new Animated.Value(1)).current, reducedNow = useRef(true);
  const [assets] = useAssets(typeof logo === "number" ? [logo] : []);
  const uri = typeof logo === "string" ? logo : assets?.[0]?.localUri;
  useEffect(() => {
    let mounted = true, animation: Animated.CompositeAnimation | undefined;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", enabled => { reducedNow.current = enabled; if (enabled) { animation?.stop(); motion.setValue(1); } });
    void (async () => {
      if (!fresh || !uri) return;
      reducedNow.current = await AccessibilityInfo.isReduceMotionEnabled().catch(() => true);
      if (!mounted || !await claimWorkoutCelebration(workoutId, finishedAt) || !mounted || reducedNow.current) return;
      motion.setValue(0);
      animation = Animated.timing(motion, { toValue: 1, duration: 1150, easing: Easing.out(Easing.cubic), useNativeDriver: true });
      animation.start();
    })();
    return () => { mounted = false; animation?.stop(); subscription.remove(); };
  }, [workoutId, finishedAt, fresh, motion, uri]);
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 112, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {particles.map((particle, index) => <Animated.View key={index} style={{ position: "absolute", left: "50%", top: "50%", width: index % 2 ? 5 : 8, height: index % 2 ? 11 : 6, backgroundColor: [colors.primary, colors.accent, colors.success][index % 3], opacity: motion.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 0.7, 0] }), transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) }, { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${particle.rotate}deg`] }) }] }} />)}
    <Animated.View style={{ width: 148, height: 148 * 880 / 1254, overflow: "hidden", transform: [{ translateY: motion.interpolate({ inputRange: [0, 0.35, 0.65, 1], outputRange: [14, -7, 3, 0] }) }, { scale: motion.interpolate({ inputRange: [0, 0.3, 0.65, 1], outputRange: [0.75, 1.08, 0.97, 1] }) }] }}><Image source={uri ? { uri } : undefined} contentFit="contain" style={{ width: 148, height: 148 }} /></Animated.View>
  </View>;
}
