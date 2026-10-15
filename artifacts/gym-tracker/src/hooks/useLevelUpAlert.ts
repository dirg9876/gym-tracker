import { useCallback, useEffect, useState } from "react";
import type { Level } from "@workspace/api-client-react";

const LAST_LEVEL_KEY = "gym-tracker:last-confirmed-level";

export function useLevelUpAlert(
  data: { confirmedLevel: number; levels: Level[] } | undefined,
) {
  const [levelUpInfo, setLevelUpInfo] = useState<{
    level: number;
    name: string;
  } | null>(null);

  const confirmedLevel = data?.confirmedLevel;

  useEffect(() => {
    if (!data) return;
    const stored = parseInt(localStorage.getItem(LAST_LEVEL_KEY) ?? "-1", 10);
    const current = data.confirmedLevel;
    if (current > stored) {
      if (stored >= 0) {
        const lvl = data.levels[current];
        if (lvl) {
          setLevelUpInfo({ level: current, name: lvl.name });
        }
      }
      localStorage.setItem(LAST_LEVEL_KEY, String(current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedLevel]);

  const dismiss = useCallback(() => setLevelUpInfo(null), []);

  return { levelUpInfo, dismissLevelUpInfo: dismiss };
}
