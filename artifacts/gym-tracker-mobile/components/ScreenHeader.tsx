import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { returnToBrand } from "@/lib/navigation";

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onHome?: () => void;
  right?: React.ReactNode;
  variant?: "default" | "transparent";
  showBack?: boolean;
};

export function ScreenHeader({ title, subtitle, onBack, onHome, right, variant = "default", showBack = true }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = onBack ?? (() => {
    if (router.canGoBack()) router.back();
    else returnToBrand();
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          backgroundColor: variant === "transparent" ? "transparent" : colors.background,
          borderBottomColor: variant === "transparent" ? "transparent" : colors.cardBorder,
          borderBottomWidth: variant === "transparent" ? 0 : 1,
        },
      ]}
    >
      {showBack ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        onPress={goBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Feather name="chevron-left" size={22} color={colors.foreground} />
      </Pressable> : null}
      {!showBack ? <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 5, height: 24, backgroundColor: colors.accent }} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <Text style={[styles.title, { color: colors.foreground, fontSize: showBack ? 16 : 20 }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="На стартовый экран Gym-Beam"
        onPress={onHome ?? returnToBrand}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="home" size={23} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
});
