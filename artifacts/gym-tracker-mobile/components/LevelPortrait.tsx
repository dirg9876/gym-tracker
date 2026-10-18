import { Image } from "expo-image";
import React from "react";
import { View } from "react-native";
import { levelImage, MALE_PORTRAIT_INSET } from "@/lib/levelImages";

type Props = {
  level: number;
  tier: number;
  sex: "male" | "female";
  size: number;
  label: string;
};

export function LevelPortrait({ level, tier, sex, size, label }: Props) {
  const inset = sex === "male" ? size * MALE_PORTRAIT_INSET : 0;
  const artSize = size - inset * 2;
  return (
    <View style={{ width: size, height: size, flexShrink: 0, borderRadius: size <= 48 ? 4 : 6, overflow: "hidden" }}>
      <Image
        source={levelImage(level, tier, sex)}
        accessibilityLabel={label}
        contentFit="contain"
        style={{ position: "absolute", left: inset, top: inset, width: artSize, height: artSize }}
      />
    </View>
  );
}
