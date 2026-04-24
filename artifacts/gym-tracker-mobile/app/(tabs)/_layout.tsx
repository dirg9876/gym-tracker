import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

import colors from "@/constants/colors";

export default function TabLayout() {
  const c = colors.dark;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.cardBorder,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Главная",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: "Программы",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "История",
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="levels"
        options={{
          title: "Уровни",
          tabBarIcon: ({ color, size }) => <Feather name="award" size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Статистика",
          tabBarIcon: ({ color, size }) => (
            <Feather name="trending-up" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: "Упражнения",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
