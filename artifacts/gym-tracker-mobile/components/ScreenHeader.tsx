import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  variant?: "default" | "transparent";
};

export function ScreenHeader({ title, subtitle, onBack, right, variant = "default" }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = onBack ?? (() => {
    if (router.canGoBack()) router.back();
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
      <Pressable
        onPress={goBack}
        hitSlop={12}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: colors.muted, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Feather name="chevron-left" size={22} color={colors.foreground} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {title ? (
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={{ width: 38 }} />}
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
});
