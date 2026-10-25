import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "gym-beam:celebrated-workouts:v1";
let queue: Promise<unknown> = Promise.resolve();
export function claimWorkoutCelebration(workoutId: number, finishedAt: string): Promise<boolean> {
  const action = queue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY), seen: unknown = raw == null ? [] : JSON.parse(raw);
      if (!Array.isArray(seen) || seen.some(key => typeof key !== "string")) return false;
      const key = `${workoutId}/${finishedAt}`;
      if (seen.includes(key)) return false;
      await AsyncStorage.setItem(KEY, JSON.stringify([...seen.slice(-127), key]));
      return true;
    } catch { return false; }
  });
  queue = action.catch(() => {});
  return action;
}
