import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkLoaded, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import colors from "@/constants/colors";
import { queryClient } from "@/lib/queryClient";

function normalizeApiOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/+$/, "");
}

const apiOrigin =
  normalizeApiOrigin(process.env.EXPO_PUBLIC_API_ORIGIN) ??
  normalizeApiOrigin(process.env.EXPO_PUBLIC_DOMAIN);

if (apiOrigin) {
  setBaseUrl(apiOrigin);
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.dark.background }} />;
  }

  if (!publishableKey) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.dark.background,
        }}
      >
        <StatusBar style="light" backgroundColor={colors.dark.background} />
        <Text
          style={{
            color: colors.dark.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 22,
            marginBottom: 8,
          }}
        >
          Настройка входа не завершена
        </Text>
        <Text
          style={{
            color: colors.dark.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          Для production-сборки укажи EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY в EAS
          Environment.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.dark.background }}>
            <SafeAreaProvider>
              <ToastProvider>
                <StatusBar style="light" backgroundColor={colors.dark.background} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.dark.background },
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="(auth)" options={{ animation: "none" }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="workout/[id]/index" />
                  <Stack.Screen name="workout/[id]/report" />
                  <Stack.Screen name="programs/[id]" />
                  <Stack.Screen name="history/[id]" />
                  <Stack.Screen name="exercises/[id]" />
                  <Stack.Screen name="profile" />
                </Stack>
              </ToastProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
