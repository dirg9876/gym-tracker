import type { CoachProfile } from "@workspace/ai-coach";
import type { OfflineState } from "./offlineApi";
import { sameLoadCategory, isTimedExercise } from "./workoutMeasurement";
import { isAssisted } from "./equipmentSettings";

export type AdaptiveDefinition = {
  exerciseId: number; sets: number; repsMin: number; repsMax: number;
  targetRir: number; intent: "strength" | "hypertrophy" | "accessory";
};

export type SplitDay = "push" | "pull" | "legs";
export type AdaptiveSplit = { day: SplitDay; name: string; reason: string; definitions: AdaptiveDefinition[] };
type Exercise = OfflineState["exercises"][number];
type SetRow = OfflineState["sets"][number];
type Slot = {
  group: string; matches: (exercise: Exercise) => boolean;
  main: boolean; sets: number;
};

const DAY = 86_400_000;
const SPLIT_DAYS: SplitDay[] = ["push", "pull", "legs"];
const NAMES: Record<SplitDay, string> = {
  push: "Сплит · Грудь, плечи и трицепс",
  pull: "Сплит · Спина и бицепс",
  legs: "Сплит · Ноги и пресс",
};

// Older catalog entries may classify a seated calf press as a "Ноги" movement.
export function planningGroup(exercise: Pick<Exercise, "name" | "muscleGroup">): string {
  return /икр|подъ[её]м.*на носки/i.test(exercise.name) ? "Икры" : exercise.muscleGroup;
}

function phaseForGroup(group: string): SplitDay | null {
  if (group === "Грудь" || group === "Плечи" || group === "Трицепс") return "push";
  if (group === "Спина" || group === "Бицепс") return "pull";
  if (group === "Ноги" || group === "Икры" || group === "Пресс") return "legs";
  return null;
}

const isChestPress = (ex: Exercise) => /жим|отжимани|брусь/i.test(ex.name);
const isLegCompound = (ex: Exercise) => /присед|жим ногами|румынск|выпад/i.test(ex.name);
const isRow = (ex: Exercise) => /тяга.*(наклон|горизонталь|гантел)|гребл/i.test(ex.name);
const isVerticalPull = (ex: Exercise) => /подтяг|верхнего блока/i.test(ex.name);
const isShoulderPress = (ex: Exercise) => /жим/i.test(ex.name);

function slots(day: SplitDay): Slot[] {
  const inGroup = (g: string, test: (ex: Exercise) => boolean) => (ex: Exercise) =>
    planningGroup(ex) === g && test(ex);
  if (day === "push") return [
    { group: "Грудь", matches: inGroup("Грудь", ex => isChestPress(ex) && !/наклон/i.test(ex.name)), main: true, sets: 3 },
    { group: "Грудь", matches: inGroup("Грудь", ex => isChestPress(ex) && (/наклон|гантел/i.test(ex.name))), main: true, sets: 3 },
    { group: "Плечи", matches: inGroup("Плечи", isShoulderPress), main: true, sets: 3 },
    { group: "Плечи", matches: inGroup("Плечи", ex => /мах|разведени/i.test(ex.name)), main: false, sets: 2 },
    { group: "Трицепс", matches: inGroup("Трицепс", () => true), main: false, sets: 2 },
    { group: "Грудь", matches: inGroup("Грудь", ex => /разводк|отжимани/i.test(ex.name)), main: false, sets: 2 },
  ];
  if (day === "pull") return [
    { group: "Спина", matches: inGroup("Спина", isVerticalPull), main: true, sets: 3 },
    { group: "Спина", matches: inGroup("Спина", isRow), main: true, sets: 3 },
    { group: "Спина", matches: inGroup("Спина", ex => /тяга|подтяг/i.test(ex.name)), main: true, sets: 3 },
    { group: "Бицепс", matches: inGroup("Бицепс", ex => /подъ[её]м|сгибани/i.test(ex.name)), main: false, sets: 2 },
    { group: "Бицепс", matches: inGroup("Бицепс", ex => /молот|сгибани/i.test(ex.name)), main: false, sets: 2 },
    { group: "Спина", matches: inGroup("Спина", ex => /тяга|подтяг/i.test(ex.name)), main: false, sets: 2 },
  ];
  return [
    { group: "Ноги", matches: inGroup("Ноги", ex => /присед|жим ногами/i.test(ex.name)), main: true, sets: 3 },
    { group: "Ноги", matches: inGroup("Ноги", ex => /румынск|сгибани ног/i.test(ex.name)), main: true, sets: 3 },
    { group: "Ноги", matches: inGroup("Ноги", ex => /выпад|разгибани ног/i.test(ex.name)), main: false, sets: 3 },
    { group: "Икры", matches: inGroup("Икры", () => true), main: false, sets: 2 },
    { group: "Пресс", matches: inGroup("Пресс", () => true), main: false, sets: 2 },
    { group: "Ноги", matches: inGroup("Ноги", isLegCompound), main: false, sets: 2 },
  ];
}

function isComparableWorkingSet(row: SetRow, ex: Exercise): boolean {
  if (row.technique === "breakdown" || isAssisted(ex)) return false;
  if (isTimedExercise(ex.name)) return row.durationSeconds != null && row.durationSeconds > 0;
  return row.durationSeconds == null && row.reps >= 5 && row.reps <= 30;
}

/**
 * Full-history three-day split; no saved monthly plan or last-template rotation.
 * All finished sessions contribute familiarity evidence. Workload from *recent*
 * sessions controls the next day's focus. Logged dates are not recovery tests.
 */
export function buildAdaptiveSplit(
  state: OfflineState, profile: CoachProfile, available: Exercise[], now: number,
): AdaptiveSplit {
  const finished = new Map(state.workouts.filter(w => w.finishedAt &&
    Number.isFinite(Date.parse(w.finishedAt)) &&
    Date.parse(w.finishedAt) <= now && Date.parse(w.startedAt) <= Date.parse(w.finishedAt),
  ).map(w => [w.id, Date.parse(w.finishedAt!)]));
  const catalog = new Map(state.exercises.map(ex => [ex.id, ex]));
  const excluded = new Set(profile.excludedExerciseIds);
  const eligible = available.filter(ex => !excluded.has(ex.id) && !isAssisted(ex));
  const familiarity = new Map<number, Set<number>>();
  const lastSeenExercise = new Map<number, number>();
  const workload = new Map<SplitDay, number>(SPLIT_DAYS.map(day => [day, 0]));
  const latestPhase = new Map<SplitDay, number>();
  for (const row of state.sets) {
    const finishedAt = finished.get(row.workoutId), ex = catalog.get(row.exerciseId);
    if (finishedAt == null || !ex || !isComparableWorkingSet(row, ex)) continue;
    const phase = phaseForGroup(planningGroup(ex));
    if (!phase) continue;
    // Decayed load covers *all* completed records, but recent sets matter most.
    const ageDays = Math.max(0, (now - finishedAt) / DAY);
    workload.set(phase, (workload.get(phase) ?? 0) + Math.exp(-ageDays / 9) *
      (["Бицепс", "Трицепс", "Икры", "Пресс"].includes(planningGroup(ex)) ? 0.5 : 1));
    latestPhase.set(phase, Math.max(finishedAt, latestPhase.get(phase) ?? 0));
    if (ex.deletedAt || ex.replacementPending || !sameLoadCategory(row, ex) ||
      (ex.equipment === "dumbbell" && (row.dumbbellCount ?? 1) !== (ex.dumbbellCount ?? 1))) continue;
    const sessions = familiarity.get(ex.id) ?? new Set<number>();
    sessions.add(row.workoutId);
    familiarity.set(ex.id, sessions);
    lastSeenExercise.set(ex.id, Math.max(lastSeenExercise.get(ex.id) ?? 0, finishedAt));
  }

  const availableDays = SPLIT_DAYS.filter(day =>
    slots(day).some(slot => eligible.some(ex => slot.matches(ex))));
  // A restricted equipment list can make some days impossible. Never invent a
  // disallowed exercise merely to fill the split.
  const candidateDays = availableDays.length ? availableDays : SPLIT_DAYS;
  const ageOf = (day: SplitDay) => latestPhase.get(day) != null ?
    (now - latestPhase.get(day)!) / DAY : Infinity;
  const priority = (day: SplitDay) => (workload.get(day) ?? 0) +
    (ageOf(day) < 2 ? 9 : ageOf(day) < 3 ? 4 : 0);
  const day = [...candidateDays].sort((a, b) =>
    priority(a) - priority(b) || SPLIT_DAYS.indexOf(a) - SPLIT_DAYS.indexOf(b))[0];

  const maxSlots = profile.sessionMinutes >= 90 ? 6 : profile.sessionMinutes >= 70 ? 5 : 4;
  const selected: AdaptiveDefinition[] = [], used = new Set<number>();
  for (const slot of slots(day).slice(0, maxSlots)) {
    const candidates = eligible.filter(ex => !used.has(ex.id) && slot.matches(ex));
    // First match the movement pattern; only *within* that pattern rank
    // familiarity. A familiar fly/leg extension cannot replace a compound lift.
    candidates.sort((a, b) => {
      const score = (ex: Exercise) => {
        const sessions = familiarity.get(ex.id)?.size ?? 0;
        const seen = lastSeenExercise.get(ex.id) ?? 0;
        return Math.min(6, sessions * 2) + (seen && now - seen < 35 * DAY ? 2 : 0) +
          (ex.isMain ? 1 : 0);
      };
      return score(b) - score(a) || a.id - b.id;
    });
    const chosen = candidates[0];
    if (!chosen) continue;
    used.add(chosen.id);
    const strength = profile.goal === "strength" && slot.main;
    const bodyweight = chosen.equipment === "bodyweight";
    selected.push({
      exerciseId: chosen.id, sets: slot.sets,
      repsMin: strength ? 3 : slot.main && bodyweight ? 6 : slot.main ? 8 : 10,
      repsMax: strength ? 6 : slot.main && bodyweight ? 10 : slot.main ? 12 : 15,
      targetRir: 2, intent: strength ? "strength" : slot.main ? "hypertrophy" : "accessory",
    });
  }
  return {
    day, name: NAMES[day], definitions: selected,
    reason: `Сплит: ${NAMES[day].replace("Сплит · ", "")}. День выбран по нагрузке из всей истории завершённых тренировок с повышенным весом недавних занятий. Сначала двигательные паттерны и базовые упражнения, затем знакомые варианты. Записи не позволяют точно оценить восстановление.`,
  };
}
