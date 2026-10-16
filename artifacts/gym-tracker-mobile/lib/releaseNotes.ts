import AsyncStorage from "@react-native-async-storage/async-storage";

export const SEEN_RELEASE_KEY = "gym-beam:release-notes:seen-version";

function versionParts(version: string): number[] | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  const parts = version.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function isNewerRelease(version: string, seen: string | null): boolean {
  const current = versionParts(version);
  if (!current) return false;
  const previous = seen === null ? null : versionParts(seen);
  if (!previous) return true;
  for (let i = 0; i < current.length; i++) {
    if (current[i] !== previous[i]) return current[i] > previous[i];
  }
  return false;
}

export function canShowReleaseNotes(path: string, activeResolved: boolean, hasActiveWorkout: boolean): boolean {
  return (path === "/" || path === "/(tabs)") && activeResolved && !hasActiveWorkout;
}

export async function hasUnreadRelease(version: string): Promise<boolean> {
  return isNewerRelease(version, await AsyncStorage.getItem(SEEN_RELEASE_KEY));
}

export async function acknowledgeRelease(version: string): Promise<void> {
  const seen = await AsyncStorage.getItem(SEEN_RELEASE_KEY);
  // An OTA rollback must not cause an already-read newer release to reappear.
  if (isNewerRelease(version, seen)) await AsyncStorage.setItem(SEEN_RELEASE_KEY, version);
}
