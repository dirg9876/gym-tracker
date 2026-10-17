import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

type Props = {
  onPress?: () => void;
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: boolean;
  testID?: string;
  fullWidth?: boolean;
};

export function Button({
  onPress,
  title,
  children,
  icon,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
  textStyle,
  haptic = true,
  testID,
  fullWidth,
}: Props) {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const sizeStyles = {
    sm: { height: 40, paddingHorizontal: 14, fontSize: 14, radius: 8 },
    md: { height: 48, paddingHorizontal: 18, fontSize: 16, radius: 8 },
    lg: { height: 56, paddingHorizontal: 22, fontSize: 17, radius: 8 },
    xl: { height: 64, paddingHorizontal: 24, fontSize: 18, radius: 8 },
  }[size];

  const variantBg = {
    primary: colors.primary,
    secondary: colors.secondary,
    ghost: "transparent",
    destructive: colors.destructive,
  }[variant];

  const variantFg = {
    primary: colors.primaryForeground,
    secondary: colors.foreground,
    ghost: colors.foreground,
    destructive: colors.destructiveForeground,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={handlePress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        {
          height: Math.ceil(sizeStyles.height * Math.max(1, Math.min(fontScale, 1.5))),
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.radius,
          backgroundColor: variantBg,
          borderWidth: 1,
          borderColor: variant === "secondary" ? colors.cardBorder : "transparent",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          width: fullWidth ? "100%" : undefined,
        },
        styles.base,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantFg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: title || children ? 8 : 0 }}>{icon}</View> : null}
          {title ? (
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              maxFontSizeMultiplier={1.5}
              numberOfLines={2}
              style={[
                {
                  color: variantFg,
                  fontSize: sizeStyles.fontSize,
                  fontFamily: "Inter_700Bold",
                  flexShrink: 1,
                  textAlign: "center",
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    flexShrink: 1,
  },
});
