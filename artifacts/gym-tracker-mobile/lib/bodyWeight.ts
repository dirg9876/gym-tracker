import { z } from "zod";
import { localDateKey } from "./trainingInsights";

export const weightDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value;
});
export const bodyWeightEntrySchema = z.object({ date: weightDateSchema, kg: z.number().finite().min(20).max(500) }).strict();
export const bodyWeightLogSchema = z.array(bodyWeightEntrySchema).max(5000).refine(rows => new Set(rows.map(row => row.date)).size === rows.length, "Повтор даты взвешивания");
export type BodyWeightEntry = z.infer<typeof bodyWeightEntrySchema>;
const day = (key: string) => Date.parse(`${key}T12:00:00Z`) / 86400000;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value: number) => Math.round(value * 10) / 10;

export function bodyWeightForecast(log: BodyWeightEntry[] = [], now = new Date()) {
  const today = localDateKey(now), todayDay = day(today);
  const history = log.filter(row => row.date <= today).slice().sort((a, b) => a.date.localeCompare(b.date));
  const recent = history.filter(row => todayDay - day(row.date) <= 55);
  const buckets = new Map<number, BodyWeightEntry[]>();
  for (const row of recent) {
    const week = Math.floor(day(row.date) / 7);
    buckets.set(week, [...(buckets.get(week) ?? []), row]);
  }
  const weekly = [...buckets.values()].map(rows => ({ x: median(rows.map(row => day(row.date))), value: median(rows.map(row => row.kg)) }));
  const last = history.at(-1);
  let reason = "Для тренда нужны минимум 6 дат взвешивания за 14 дней и данные минимум трёх недель.";
  let status: "insufficient" | "stale" | "unstable" | "ready" = "insufficient";
  let weeklyChangeKg: number | null = null;
  const points: Array<{ date: string; value: number; low: number; high: number }> = [];
  if (last && todayDay - day(last.date) > 14) { status = "stale"; reason = "Последнее взвешивание старше 14 дней. Нужна свежая запись, а не продолжение старого тренда."; }
  else if (recent.length >= 6 && weekly.length >= 3 && day(recent.at(-1)!.date) - day(recent[0].date) >= 14) {
    const slopes: number[] = [];
    for (let i = 0; i < weekly.length; i++) for (let j = i + 1; j < weekly.length; j++) slopes.push((weekly[j].value - weekly[i].value) / (weekly[j].x - weekly[i].x));
    const slope = median(slopes), anchor = median(weekly.map(row => row.value + slope * (todayDay - row.x)));
    const variation = Math.max(0.2, median(weekly.map(row => Math.abs(row.value - (anchor + slope * (row.x - todayDay))))) * 1.4826);
    if (Math.abs(slope * 7) > last!.kg * 0.02 || [7, 14, 28].some(days => anchor + slope * days < 20 || anchor + slope * days > 500)) {
      status = "unstable"; reason = "Изменения слишком резкие для устойчивой экстраполяции. Проверьте записи; численный прогноз не построен.";
    } else {
      status = "ready"; weeklyChangeKg = round(slope * 7);
      reason = "Медианный тренд недельных значений за последние 56 дней. Условие: прежние условия питания и активности сохраняются. Это масса тела, не прирост мышц.";
      for (const days of [7, 14, 28]) {
        const date = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
        const value = anchor + slope * days, spread = variation * (1 + days / 28);
        points.push({ date, value: round(value), low: round(Math.max(20, value - spread)), high: round(Math.min(500, value + spread)) });
      }
    }
  }
  return { status, history, weeklyChangeKg, points, reason, method: "Недельные медианы → медиана парных наклонов (Theil–Sen). Полоса — наблюдавшаяся вариация с запасом, не доверительный интервал. Порог достаточности — правило приложения, не клинически валидированная модель." };
}
