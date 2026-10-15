import { router } from "expo-router";

export function returnToBrand() {
  // Close nested screens, then select Home explicitly.
  router.dismissTo("/(tabs)");
  router.navigate("/(tabs)");
}
