import type { CoachProfile } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { sameLoadCategory, isTimedExercise } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";

export type AdaptiveDefinition = {
  exerciseId: number; sets: number; repsMin: number; repsMax: number;
  targetRir: number; intent: "strength" | "hypertrophy" | "accessory";
};

type Exercise = OfflineState["exercises"][number];
type Stats = { recentLoad: number; lastAt: number; sessions: Set<number> };
const DAY = 86_400_000;
const PRIMARY = ["Ноги", "Спина", "Грудь", "Плечи"] as const;
const SECONDARY = ["Пресс", "Бицепс", "Трицепс", "Икры"] as const;

// Calf press can be catalogued as "Ноги" in older backups. It is not a quad movement.
export function planningGroup(exercise: Pick<Exercise, "name" | "muscleGroup">): string {
  return /икр|подъ[её]м.*на носки/i.test(exercise.name) ? "Икры" : exercise.muscleGroup;
}

// Prefer multi-joint patterns to single-muscle work, but let real experience outrank
// an unfamiliar exercise. No exercise identity is inferred from a generic muscle group.
function patternScore(exercise: Exercise, group: string): number {
  const name = exercise.name.toLowerCase();
  if (group === "Ноги") return /присед|жим ногами|выпад|румынск/.test(name) ? 18 : /становая|сгибани|разгибани/.test(name) ? 9 : 0;
  if (group === "Спина") return /подтяг|тяга|тяг[ау] верхнего блока/.test(name) ? 18 : 0;
  if (group === "Грудь") return /жим|отжиман|брусь/.test(name) ? 18 : /разводк/.test(name) ? 7 : 0;
  if (group === "Плечи") return /жим/.test(name) ? 18 : /мах|подъ[её]м/.test(name) ? 7 : 0;
  return 0;
}

/**
 * Builds the next *independent* workout from the entire completed training log.
 *
 * Lifetime history decides exercise familiarity, while exponentially decayed
 * workload and time since last exposure decide priority. Neither a single
 * previous session nor the 7-day minimum-group list determines the program.
 * The result does not claim to measure physiological recovery.
 */
export function buildAdaptiveDefinitions(
  state: OfflineState, profile: CoachProfile, available: Exercise[], now: number,
): AdaptiveDefinition[] {
  const ended = new Map(state.workouts.filter(w =>
    w.finishedAt && Number.isFinite(Date.parse(w.finishedAt)) &&
    Date.parse(w.finishedAt) <= now && Date.parse(w.startedAt) <= Date.parse(w.finishedAt),
  ).map(w => [w.id, Date.parse(w.finishedAt!)]));
  const catalog = new Map(state.exercises.map(ex => [ex.id, ex]));
  const exposure = new Map<number, Stats>();
  const groups = new Map<string, Stats>();
  const ensure = <K,>(map: Map<K, Stats>, key: K): Stats => {
    const found = map.get(key);
    if (found) return found;
    const fresh: Stats = { recentLoad: 0, lastAt: 0, sessions: new Set() };
    map.set(key, fresh);
    return fresh;
  };

  for (const set of state.sets) {
    const finishedAt = ended.get(set.workoutId);
    const ex = catalog.get(set.exerciseId);
    if (finishedAt == null || !ex || set.technique === "breakdown") continue;
    const timed = isTimedExercise(ex.name);
    // Heavy singles are tests, not ordinary programming volume or familiarity.
    if (timed ? !(set.durationSeconds != null && set.durationSeconds > 0) : set.reps < 3 || set.reps > 30) continue;
    const group = planningGroup(ex);
    const g = ensure(groups, group);
    const daysAgo = Math.max(0, (now - finishedAt) / DAY);
    g.recentLoad += Math.exp(-daysAgo / 8);
    g.lastAt = Math.max(g.lastAt, finishedAt);
    g.sessions.add(set.workoutId);

    if (ex.deletedAt || ex.replacementPending || !sameLoadCategory(set, ex) ||
        (ex.equipment === "dumbbell" && (set.dumbbellCount ?? 1) !== (ex.dumbbellCount ?? 1))) continue;
    if (!timed && set.reps < 5) continue;
    const e = ensure(exposure, ex.id);
    e.recentLoad += Math.exp(-daysAgo / 14);
    e.lastAt = Math.max(e.lastAt, finishedAt);
    e.sessions.add(set.workoutId);
  }

  const groupOrder = (a: string, b: string) => {
    const priority = (group: string) => {
      const item = groups.get(group);
      const ageDays = item?.lastAt ? (now - item.lastAt) / DAY : Infinity;
      // A recently used muscle is less desirable, but never diagnosed as
      // "not recovered" based on session timestamps alone.
      return (item?.recentLoad ?? 0) + (ageDays < 2 ? 9 : ageDays < 3 ? 4 : 0);
    };
    return priority(a) - priority(b) || a.localeCompare(b, "ru");
  };

  const excluded = new Set(state.coachProfile?.excludedExerciseIds ?? []);
  const eligible = available.filter(ex => !excluded.has(ex.id) && !isAssisted(ex));
  const pick = (group: string, used: Set<number>): Exercise | null => {
    const matches = eligible.filter(ex => planningGroup(ex) === group && !used.has(ex.id));
    const score = (ex: Exercise) => {
      const stat = exposure.get(ex.id);
      const days = stat?.lastAt ? (now - stat.lastAt) / DAY : Infinity;
      return patternScore(ex, group) +
        (stat ? 20 + Math.min(stat.sessions.size, 10) * 2 : 0) +
        (days <= 35 ? 5 : 0) +
        (ex.isMain && PRIMARY.includes(group as typeof PRIMARY[number]) ? 5 : 0);
    };
    matches.sort((a, b) => score(b) - score(a) || a.id - b.id);
    return matches[0] ?? null;
  };

  const primaryCount = profile.sessionMinutes >= 75 ? 4 : 3;
  const accessoryCount = profile.sessionMinutes >= 90 ? 2 : 1;
  const selected: AdaptiveDefinition[] = [];
  const used = new Set<number>();
  const add = (ex: Exercise, main: boolean) => {
    used.add(ex.id);
    const isStrength = profile.goal === "strength" && main;
    const bodyweight = ex.equipment === "bodyweight";
    selected.push({
      exerciseId: ex.id, sets: main ? 3 : 2,
      repsMin: isStrength ? 3 : main && bodyweight ? 6 : main ? 8 : 10,
      repsMax: isStrength ? 6 : main && bodyweight ? 10 : main ? 12 : 15,
      targetRir: 2, intent: isStrength ? "strength" : main ? "hypertrophy" : "accessory",
    });
  };

  const mains = PRIMARY.filter(group => eligible.some(ex => planningGroup(ex) === group)).sort(groupOrder);
  for (const group of mains.slice(0, primaryCount)) {
    const ex = pick(group, used);
    if (ex) add(ex, true);
  }
  const extra = SECONDARY.filter(group => eligible.some(ex => planningGroup(ex) === group)).sort((a, b) => {
    // Core is a useful accessory even if calves have zero recorded sets.
    const aHistory = eligible.some(ex => planningGroup(ex) === a && exposure.has(ex.id));
    const bHistory = eligible.some(ex => planningGroup(ex) === b && exposure.has(ex.id));
    return Number(bHistory) - Number(aHistory) || groupOrder(a, b);
  });
  for (const group of extra.slice(0, accessoryCount)) {
    const ex = pick(group, used);
    if (ex) add(ex, false);
  }
  // Restricted catalogs may contain only one or two movement groups.
  if (!selected.length) {
    const fallback = eligible.slice().sort((a, b) => a.id - b.id)[0];
    if (fallback) add(fallback, true);
  }
  return selected;
}
