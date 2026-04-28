import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileCard } from "@/components/ProfileCard";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader title="Профиль" onBack={() => router.back()} />
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 14 }}>
        Вес, рост и пол используются для нормативов, уровней и упражнений со своим весом.
      </Text>
      <ProfileCard />
    </ScrollView>
  );
}
