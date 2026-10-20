import { useFonts } from "expo-font";
import Feather from "@expo/vector-icons/Feather";
import { QueryClientProvider } from "@tanstack/react-query";
import { setCustomFetchHandler } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { ReleaseNotesProvider } from "@/components/ReleaseNotes";
import colors from "@/constants/colors";
import { offlineApiFetch } from "@/lib/offlineApi";
import { queryClient } from "@/lib/queryClient";
import { runAutomaticBackup } from "@/lib/automaticBackup";

setCustomFetchHandler(offlineApiFetch);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => { runAutomaticBackup().catch(() => {}); }, []);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
    Inter_900Black_Italic: require("@expo-google-fonts/inter/900Black_Italic/Inter_900Black_Italic.ttf"),
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.dark.background }} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.dark.background }}>
        <SafeAreaProvider>
          <ToastProvider>
            <ReleaseNotesProvider>
            <StatusBar style="light" backgroundColor={colors.dark.background} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.dark.background },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="backup" />
              <Stack.Screen name="updates" />
              <Stack.Screen name="coach" />
              <Stack.Screen name="coach-plan" />
              <Stack.Screen name="coach-session" />
              <Stack.Screen name="coach-month" />
              <Stack.Screen name="exercises/index" />
              <Stack.Screen name="exercise-replacement" />
              <Stack.Screen name="workout/[id]/index" />
              <Stack.Screen name="workout/[id]/report" />
              <Stack.Screen name="programs/[id]" options={{ gestureEnabled: false }} />
              <Stack.Screen name="history/[id]" />
              <Stack.Screen name="exercises/[id]" />
            </Stack>
            </ReleaseNotesProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
