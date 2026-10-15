import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import colors from "@/constants/colors";

export default function TabLayout() {
  const c = colors.dark;
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      screenOptions={{
        header: ({ options }) => <ScreenHeader title={options.title} showBack={false} />,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          backgroundColor: c.background,
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
          height: 24,
          textAlign: "center",
        },
      }}
    >
      <Tabs.Screen
        name="programs"
        options={{
          title: "Виды тренировок",
          tabBarAccessibilityLabel: "Виды тренировок",
          tabBarLabel: ({ color }) => <Text style={[styles.typesLabel, { color }]}>Виды{"\n"}тренировок</Text>,
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "История",
          tabBarIcon: ({ color }) => <Feather name="clock" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Главная",
          headerShown: false,
          tabBarLabelStyle: { ...styles.homeLabel, height: 24 },
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
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="levels"
        options={{
          title: "Уровни",
          tabBarIcon: ({ color }) => <Feather name="award" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  typesLabel: { height: 24, fontSize: 10, lineHeight: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  homeLabel: { fontSize: 12, lineHeight: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  homeIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
