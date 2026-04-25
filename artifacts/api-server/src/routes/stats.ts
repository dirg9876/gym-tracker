import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
import { GetExerciseProgressParams, GetHeatmapQueryParams } from "@workspace/api-zod";
import {
  getAllSetsForFinishedWorkouts,
  listFinishedWorkouts,
  totalsFromSets,
  round,
  type EnrichedSet,
} from "../lib/stats";
import { computeCurrentLevel } from "../lib/levels";

const router: IRouter = Router();

function groupByWorkout(sets: EnrichedSet[]): Map<number, EnrichedSet[]> {
  const m = new Map<number, EnrichedSet[]>();
  for (const s of sets) {
    const a = m.get(s.workoutId) ?? [];
    a.push(s);
    m.set(s.workoutId, a);
  }
  return m;
}

router.get("/stats/overview", async (_req, res): Promise<void> => {
  const sets = await getAllSetsForFinishedWorkouts();
  const workouts = await listFinishedWorkouts();
  const byWorkout = groupByWorkout(sets);

  let totalVolume = 0;
  let totalReps = 0;
  let totalSets = 0;
  let bestTonnage = 0;
  let bestReps = 0;
  let bestMaxWeight = 0;

  for (const ws of byWorkout.values()) {
    const t = totalsFromSets(ws);
    totalVolume += t.totalVolume;
    totalReps += t.totalReps;
    totalSets += t.totalSets;
    if (t.totalVolume > bestTonnage) bestTonnage = t.totalVolume;
    if (t.totalReps > bestReps) bestReps = t.totalReps;
    for (const s of ws) {
      if (s.weightKg > bestMaxWeight) bestMaxWeight = s.weightKg;
    }
  }

  // Top exercises across all workouts
  const exMap = new Map<
    number,
    { name: string; muscleGroup: string; sets: number; volume: number; maxWeightKg: number }
  >();
  for (const s of sets) {
    const e = exMap.get(s.exerciseId) ?? {
      name: s.exerciseName,
      muscleGroup: s.muscleGroup,
      sets: 0,
      volume: 0,
      maxWeightKg: 0,
    };
    e.sets += 1;
    e.volume += s.volume;
    if (s.weightKg > e.maxWeightKg) e.maxWeightKg = s.weightKg;
    exMap.set(s.exerciseId, e);
  }
  const topExercises = [...exMap.entries()]
    .map(([exerciseId, v]) => ({
      exerciseId,
      name: v.name,
      muscleGroup: v.muscleGroup,
      sets: v.sets,
      volume: round(v.volume),
      maxWeightKg: v.maxWeightKg,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);

  // Muscle group breakdown
  const mg = new Map<string, { volume: number; sets: number }>();
  for (const s of sets) {
    const e = mg.get(s.muscleGroup) ?? { volume: 0, sets: 0 };
    e.volume += s.volume;
    e.sets += 1;
    mg.set(s.muscleGroup, e);
  }
  const muscleGroupVolume = [...mg.entries()]
    .map(([muscleGroup, v]) => ({ muscleGroup, volume: round(v.volume), sets: v.sets }))
    .sort((a, b) => b.volume - a.volume);

  // Streak: consecutive days with a finished workout up to today
  const dayKeys = new Set<string>();
  for (const w of workouts) {
    const d = w.startedAt;
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dayKeys.add(k);
  }
  function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }
  let streak = 0;
  const probe = new Date();
  // start from today; if today not present, allow yesterday
  if (!dayKeys.has(dayKey(probe))) {
    probe.setDate(probe.getDate() - 1);
  }
  while (dayKeys.has(dayKey(probe))) {
    streak += 1;
    probe.setDate(probe.getDate() - 1);
  }

  // Workouts in the last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekWorkouts = workouts.filter((w) => w.startedAt >= weekAgo).length;

  res.json({
    totalWorkouts: workouts.length,
    totalVolume: round(totalVolume),
    totalReps,
    totalSets,
    bestTonnage: round(bestTonnage),
    bestReps,
    bestMaxWeight,
    currentStreakDays: streak,
    weekWorkouts,
    topExercises,
    muscleGroupVolume,
  });
});

router.get("/stats/progress", async (_req, res): Promise<void> => {
  const sets = await getAllSetsForFinishedWorkouts();
  const workouts = await listFinishedWorkouts();
  const wMap = new Map(workouts.map((w) => [w.id, w]));
  const byWorkout = groupByWorkout(sets);
  const points = [...byWorkout.entries()]
    .map(([workoutId, ws]) => {
      const t = totalsFromSets(ws);
      const maxW = ws.reduce((m, s) => Math.max(m, s.weightKg), 0);
      const w = wMap.get(workoutId);
      return {
        workoutId,
        date: (w?.startedAt ?? new Date()).toISOString(),
        volume: t.totalVolume,
        reps: t.totalReps,
        maxWeight: maxW,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json({ points });
});

router.get(
  "/stats/exercises/:exerciseId/progress",
  async (req, res): Promise<void> => {
    const parsed = GetExerciseProgressParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const exerciseId = parsed.data.exerciseId;
    const [exercise] = await db
      .select()
      .from(exercisesTable)
      .where(eq(exercisesTable.id, exerciseId));
    if (!exercise) {
      res.status(404).json({ error: "Упражнение не найдено" });
      return;
    }

    const allSets = await getAllSetsForFinishedWorkouts();
    const exerciseSets = allSets.filter((s) => s.exerciseId === exerciseId);
    const workouts = await listFinishedWorkouts();
    const wMap = new Map(workouts.map((w) => [w.id, w]));

    const byWorkout = groupByWorkout(exerciseSets);
    const points = [...byWorkout.entries()]
      .map(([workoutId, ws]) => {
        const t = totalsFromSets(ws);
        let topSet = { weightKg: 0, reps: 0 };
        for (const s of ws) {
          if (s.weightKg > topSet.weightKg) {
            topSet = { weightKg: s.weightKg, reps: s.reps };
          }
        }
        const w = wMap.get(workoutId);
        return {
          workoutId,
          date: (w?.startedAt ?? new Date()).toISOString(),
          volume: t.totalVolume,
          reps: t.totalReps,
          maxWeight: topSet.weightKg,
          topSet,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      exercise,
      points,
    });
  },
);

router.get("/stats/heatmap", async (req, res): Promise<void> => {
  const parsed = GetHeatmapQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const days = Math.max(7, Math.min(parsed.data.days ?? 365, 730));
  const sets = await getAllSetsForFinishedWorkouts();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  function toKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  const buckets = new Map<string, { volume: number; sets: number }>();
  for (const s of sets) {
    const dt = new Date(s.createdAt);
    if (dt < start) continue;
    const key = toKey(dt);
    const e = buckets.get(key) ?? { volume: 0, sets: 0 };
    e.volume += s.volume;
    e.sets += 1;
    buckets.set(key, e);
  }

  const daysOut: Array<{
    date: string;
    volume: number;
    sets: number;
    intensity: number;
  }> = [];
  let maxVolume = 0;
  for (const [, v] of buckets) {
    if (v.volume > maxVolume) maxVolume = v.volume;
  }

  function intensityFor(v: number): number {
    if (v <= 0 || maxVolume <= 0) return 0;
    const ratio = v / maxVolume;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  let activeDays = 0;
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = toKey(cursor);
    const v = buckets.get(key) ?? { volume: 0, sets: 0 };
    if (v.volume > 0) activeDays += 1;
    daysOut.push({
      date: key,
      volume: round(v.volume),
      sets: v.sets,
      intensity: intensityFor(v.volume),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  res.json({
    days: daysOut,
    maxVolume: round(maxVolume),
    totalDays: daysOut.length,
    activeDays,
  });
});

router.get("/stats/forecast", async (_req, res): Promise<void> => {
  const info = await computeCurrentLevel();
  const cur = info.currentLevel;
  const next = info.nextLevel;

  const sets = await getAllSetsForFinishedWorkouts();

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const window7 = now - 7 * dayMs;
  const window30 = now - 30 * dayMs;
  let tonnage7 = 0;
  let tonnage30 = 0;
  for (const s of sets) {
    const t = new Date(s.createdAt).getTime();
    if (t >= window30) tonnage30 += s.volume;
    if (t >= window7) tonnage7 += s.volume;
  }
  const avgDaily = tonnage30 / 30;

  if (next === null || cur >= info.levels.length - 1) {
    res.json({
      currentLevel: cur,
      nextLevel: null,
      nextLevelName: null,
      tonnageNeededKg: 0,
      tonnage7dKg: round(tonnage7),
      tonnage30dKg: round(tonnage30),
      avgDailyTonnageKg: round(avgDaily),
      estimatedDays: null,
      confidence: "achieved" as const,
    });
    return;
  }

  const nextDef = info.levels[next]!;
  const tonnageNeeded = Math.max(
    0,
    nextDef.tonnage30dKgRequired - info.stats.currentTonnage30dKg,
  );

  let estimatedDays: number | null = null;
  let confidence: "low" | "medium" | "high" = "low";
  if (avgDaily > 0) {
    estimatedDays = Math.ceil(tonnageNeeded / avgDaily);
    if (estimatedDays > 365) estimatedDays = 365;
    if (tonnage7 > 0 && tonnage30 > 0) {
      const ratio = tonnage7 / 7 / avgDaily;
      if (ratio >= 0.8 && ratio <= 1.5) confidence = "high";
      else confidence = "medium";
    }
  }

  res.json({
    currentLevel: cur,
    nextLevel: next,
    nextLevelName: nextDef.name,
    tonnageNeededKg: round(tonnageNeeded),
    tonnage7dKg: round(tonnage7),
    tonnage30dKg: round(tonnage30),
    avgDailyTonnageKg: round(avgDaily),
    estimatedDays,
    confidence,
  });
});

export default router;
