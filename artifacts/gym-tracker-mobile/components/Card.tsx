import React from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  testID?: string;
};

export function Card({ children, onPress, style, padding = 16, testID }: Props) {
  const colors = useColors();

  const baseStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={[baseStyle, style]}>
      {children}
    </View>
  );
}
