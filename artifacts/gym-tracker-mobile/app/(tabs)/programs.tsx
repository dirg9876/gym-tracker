import { Feather } from "@expo/vector-icons";
import { useListPrograms } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { useColors } from "@/hooks/useColors";

export default function ProgramsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useListPrograms();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        gap: 18,
      }}
    >
      <View>
        <Text style={[styles.h1, { color: colors.foreground }]}>Программы</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Готовые тренировки на силу и массу. Вес подстроен под твой уровень.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {data?.programs.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/programs/${p.id}`)} padding={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: colors.muted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text
                  style={[styles.desc, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {p.description}
                </Text>
                <Text style={[styles.meta, { color: colors.primary }]}>
                  {p.exerciseCount} упражнений
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  name: { fontSize: 16, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  meta: { fontSize: 11, fontFamily: "Inter_700Bold", marginTop: 4, letterSpacing: 0.6 },
});
