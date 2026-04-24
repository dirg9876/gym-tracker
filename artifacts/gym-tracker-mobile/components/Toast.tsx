import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
};

type ShowFn = (kind: ToastKind, title: string, description?: string) => void;

const ToastCtx = createContext<{ show: ShowFn } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback<ShowFn>((kind, title, description) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, kind, title, description }]);
    if (Platform.OS !== "web") {
      const fb =
        kind === "success"
          ? Haptics.NotificationFeedbackType.Success
          : kind === "error"
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning;
      Haptics.notificationAsync(fb).catch(() => {});
    }
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <ToastViewport items={items} />
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

function ToastViewport({ items }: { items: ToastItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + 8 }]}>
      {items.map((t) => (
        <ToastView key={t.id} item={t} />
      ))}
    </View>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const accent =
    item.kind === "success"
      ? colors.primary
      : item.kind === "error"
        ? colors.destructive
        : colors.foreground;
  const iconName =
    item.kind === "success" ? "check-circle" : item.kind === "error" ? "alert-circle" : "info";

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Feather name={iconName as never} size={18} color={accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        {item.description ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
