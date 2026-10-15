import Feather from "@expo/vector-icons/Feather";
import { useListPrograms } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useColors } from "@/hooks/useColors";

export default function WorkoutTypesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useListPrograms();
  const programs = data?.programs ?? [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 24, gap: 20 }}
    >
      <Button title="Создать вид тренировки" icon={<Feather name="plus" size={18} color={colors.primaryForeground} />} onPress={() => router.push("/programs/new")} />
      <Button title="Управление упражнениями" variant="secondary" icon={<Feather name="edit-3" size={18} color={colors.foreground} />} onPress={() => router.push("/exercises")} />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : isError ? (
        <Button title="Повторить загрузку" variant="secondary" icon={<Feather name="refresh-cw" size={18} color={colors.foreground} />} onPress={() => { void refetch(); }} />
      ) : programs.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="grid" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>Нет сохранённых видов тренировок</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {programs.map(program => (
            <Card key={program.id} onPress={() => router.push(`/programs/${program.id}`)} padding={14}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.programIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="activity" size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{program.name}</Text>
                  {program.description ? <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{program.description}</Text> : null}
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>{program.exerciseCount} упр.</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 40 },
  emptyLabel: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular", textAlign: "center" },
  programIcon: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 17 },
  meta: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 5 },
});
