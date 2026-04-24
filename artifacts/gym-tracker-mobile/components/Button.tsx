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

  const handlePress = () => {
    if (disabled || loading) return;
    if (haptic && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const sizeStyles = {
    sm: { height: 36, paddingHorizontal: 14, fontSize: 14, radius: 10 },
    md: { height: 48, paddingHorizontal: 18, fontSize: 16, radius: 14 },
    lg: { height: 56, paddingHorizontal: 22, fontSize: 17, radius: 16 },
    xl: { height: 64, paddingHorizontal: 24, fontSize: 18, radius: 18 },
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
      onPress={handlePress}
      disabled={disabled || loading}
      testID={testID}
      style={({ pressed }) => [
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: sizeStyles.radius,
          backgroundColor: variantBg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          width: fullWidth ? "100%" : undefined,
        },
        styles.base,
        variant === "primary" && {
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
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
              style={[
                {
                  color: variantFg,
                  fontSize: sizeStyles.fontSize,
                  fontFamily: "Inter_700Bold",
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
  },
});
