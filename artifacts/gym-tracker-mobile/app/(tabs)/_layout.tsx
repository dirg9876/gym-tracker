import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import colors from "@/constants/colors";

function TabCaption({ title, color, home = false }: { title: string; color: string; home?: boolean }) {
  return <Text maxFontSizeMultiplier={1} numberOfLines={2} style={[styles.caption, home && styles.homeLabel, { color }]}>{title}</Text>;
}

export default function TabLayout() {
  const c = colors.dark;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={{
        header: ({ options }) => <ScreenHeader title={options.title} showBack={false} />,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.cardBorder,
          borderTopWidth: 1,
          height: 80 + insets.bottom,
          paddingTop: 0,
          paddingBottom: insets.bottom,
        },
        tabBarIconStyle: { width: 52, height: 44 },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          lineHeight: 12,
          height: 28,
          textAlign: "center",
        },
      }}
    >
      <Tabs.Screen
        name="programs"
        options={{
          title: "Виды тренировок",
          tabBarAccessibilityLabel: "Виды тренировок",
          tabBarLabel: ({ color }) => <TabCaption title={"Виды\nтренировок"} color={color} />,
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "История",
          tabBarLabel: ({ color }) => <TabCaption title="История" color={color} />,
          tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Главная",
          headerShown: false,
          tabBarLabelStyle: { ...styles.homeLabel, height: 24 },
          tabBarLabel: ({ focused }) => <TabCaption title="Главная" color={focused ? c.primary : c.mutedForeground} home />,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.homeIcon, { backgroundColor: focused ? c.primary : c.primarySoft, borderColor: c.primary }]}>
              <Feather name="home" size={28} color={focused ? c.primaryForeground : c.primary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Статистика",
          tabBarLabel: ({ color }) => <TabCaption title="Статистика" color={color} />,
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="levels"
        options={{
          title: "Уровни",
          tabBarLabel: ({ color }) => <TabCaption title="Уровни" color={color} />,
          tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Recover the tab button's inset for long Russian labels without crossing into its neighbours.
  caption: { height: 28, alignSelf: "stretch", marginHorizontal: -4, fontSize: 10, lineHeight: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  homeLabel: { fontSize: 12, lineHeight: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  homeIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
