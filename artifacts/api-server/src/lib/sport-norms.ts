/**
 * Sport standards and rank definitions for the gym tracker level system.
 *
 * MS (Мастер спорта) standards:
 *   Big-3 (squat/bench/deadlift) — ФПР (Федерация Пауэрлифтинга России),
 *   ЕВСК 2024, классический пауэрлифтинг raw (без экипировки).
 *   Источник: https://fprussia.ru/informaciya/normativy/
 *
 * All other exercises: empirical coefficients relative to the bench press MS
 *   target, based on Strength Level Elite-tier ratios (≈ MS equivalent).
 *   These are NOT official norms — they are coaching-table approximations.
 */

export type Sex = "male" | "female";

// ---------------------------------------------------------------------------
// MS standards by weight class
// ---------------------------------------------------------------------------

interface MsRow {
  weightClassKg: number;
  squat: number;
  bench: number;
  deadlift: number;
}

/**
 * Classic raw powerlifting MS standards (men, women).
 * The last entry in each array represents the "over" (open) weight class;
 * its weightClassKg is a practical anchor for interpolation purposes only.
 */
const MS_STANDARDS: Record<Sex, MsRow[]> = {
  male: [
    { weightClassKg: 59,  squat: 167.5, bench: 115,   deadlift: 197.5 },
    { weightClassKg: 66,  squat: 187.5, bench: 130,   deadlift: 217.5 },
    { weightClassKg: 74,  squat: 207.5, bench: 147.5, deadlift: 237.5 },
    { weightClassKg: 83,  squat: 227.5, bench: 165,   deadlift: 257.5 },
    { weightClassKg: 93,  squat: 247.5, bench: 180,   deadlift: 280   },
    { weightClassKg: 105, squat: 265,   bench: 195,   deadlift: 300   },
    { weightClassKg: 120, squat: 285,   bench: 215,   deadlift: 320   },
    { weightClassKg: 150, squat: 302.5, bench: 227.5, deadlift: 340   }, // 120+ class
  ],
  female: [
    { weightClassKg: 47,  squat: 100,   bench: 62.5,  deadlift: 120   },
    { weightClassKg: 52,  squat: 115,   bench: 67.5,  deadlift: 137.5 },
    { weightClassKg: 57,  squat: 125,   bench: 72.5,  deadlift: 150   },
    { weightClassKg: 63,  squat: 140,   bench: 82.5,  deadlift: 167.5 },
    { weightClassKg: 72,  squat: 155,   bench: 92.5,  deadlift: 185   },
    { weightClassKg: 84,  squat: 170,   bench: 102.5, deadlift: 200   },
    { weightClassKg: 120, squat: 182.5, bench: 112.5, deadlift: 215   }, // 84+ class
  ],
};

// ---------------------------------------------------------------------------
// Weight-class lookup + interpolation
// ---------------------------------------------------------------------------

/** Returns the official competition weight class for a given bodyweight. */
export function getWeightClassKg(bodyWeightKg: number, sex: Sex): number {
  const rows = MS_STANDARDS[sex];
  for (const row of rows) {
    if (bodyWeightKg <= row.weightClassKg) return row.weightClassKg;
  }
  return rows[rows.length - 1]!.weightClassKg;
}

/**
 * Returns interpolated MS kg values for the three classic lifts.
 * Athletes between weight classes get linearly interpolated targets so the
 * formula is continuous, not step-wise.
 */
function interpolateMs(
  bodyWeightKg: number,
  sex: Sex,
): { squat: number; bench: number; deadlift: number } {
  const rows = MS_STANDARDS[sex];

  // Below lightest class — use lightest
  if (bodyWeightKg <= rows[0]!.weightClassKg) {
    return { squat: rows[0]!.squat, bench: rows[0]!.bench, deadlift: rows[0]!.deadlift };
  }

  // Above heaviest class — use heaviest
  const last = rows[rows.length - 1]!;
  if (bodyWeightKg >= last.weightClassKg) {
    return { squat: last.squat, bench: last.bench, deadlift: last.deadlift };
  }

  // Find surrounding rows and interpolate
  for (let i = 1; i < rows.length; i++) {
    const lower = rows[i - 1]!;
    const upper = rows[i]!;
    if (bodyWeightKg <= upper.weightClassKg) {
      const t = (bodyWeightKg - lower.weightClassKg) / (upper.weightClassKg - lower.weightClassKg);
      return {
        squat:    lower.squat    + (upper.squat    - lower.squat)    * t,
        bench:    lower.bench    + (upper.bench    - lower.bench)    * t,
        deadlift: lower.deadlift + (upper.deadlift - lower.deadlift) * t,
      };
    }
  }

  return { squat: last.squat, bench: last.bench, deadlift: last.deadlift };
}

// ---------------------------------------------------------------------------
// Per-exercise norm config
// ---------------------------------------------------------------------------

type NormConfig =
  | { kind: "classic"; lift: "squat" | "bench" | "deadlift" }
  | { kind: "coefficient"; anchor: "squat" | "bench" | "deadlift"; ratio: number }
  | { kind: "bodyweight_ratio"; ratio: number }
  | { kind: "time_based"; secondsAtMS: number };

/**
 * Norm config for each known exercise.
 * "classic" — uses the official MS table directly.
 * "coefficient" — ratio of an anchor classic lift's MS value.
 * "bodyweight_ratio" — ratio of the athlete's bodyweight (e.g. weighted pull-ups).
 * "time_based" — time-based target, no kg norm.
 */
const EXERCISE_NORMS: Record<string, NormConfig> = {
  // Big 3 — official MS standards
  "Приседания со штангой":          { kind: "classic",      lift: "squat" },
  "Жим штанги лёжа":                { kind: "classic",      lift: "bench" },
  "Становая тяга":                  { kind: "classic",      lift: "deadlift" },

  // Barbell accessories — coefficient of bench MS
  "Жим штанги на наклонной скамье": { kind: "coefficient",  anchor: "bench", ratio: 0.85 },
  "Тяга штанги в наклоне":          { kind: "coefficient",  anchor: "bench", ratio: 0.85 },
  "Жим штанги стоя":                { kind: "coefficient",  anchor: "bench", ratio: 0.65 },
  "Подъём штанги на бицепс":        { kind: "coefficient",  anchor: "bench", ratio: 0.50 },
  "Румынская тяга":                 { kind: "coefficient",  anchor: "deadlift", ratio: 0.75 },

  // Dumbbell — per-dumbbell target, coefficient of bench MS
  "Жим гантелей лёжа":              { kind: "coefficient",  anchor: "bench", ratio: 0.40 },
  "Жим гантелей сидя":              { kind: "coefficient",  anchor: "bench", ratio: 0.30 },
  "Тяга гантели одной рукой":       { kind: "coefficient",  anchor: "bench", ratio: 0.45 },

  // Machine / cable — coefficient of bench MS
  "Тяга верхнего блока":            { kind: "coefficient",  anchor: "bench", ratio: 0.75 },
  "Тяга горизонтального блока":     { kind: "coefficient",  anchor: "bench", ratio: 0.75 },

  // Bodyweight — total weight (bodyweight + extra load) ratio at MS
  "Подтягивания":                   { kind: "bodyweight_ratio", ratio: 1.65 },
  "Отжимания узким хватом":         { kind: "bodyweight_ratio", ratio: 1.00 },

  // Time-based — no kg requirement
  "Планка":                         { kind: "time_based", secondsAtMS: 60 },
};

// ---------------------------------------------------------------------------
// Public helper
// ---------------------------------------------------------------------------

export type McSource = "classic" | "coefficient" | "bodyweight" | "time" | "fallback";

export type McResult = {
  /** MS-equivalent kg for this exercise. null for time-based exercises. */
  kg: number | null;
  source: McSource;
};

/**
 * Returns the Master-of-Sport (МС) equivalent kg target for an exercise,
 * given the athlete's bodyweight and sex.
 *
 * For known exercises, uses the EXERCISE_NORMS config above.
 * For unknown / user-created exercises, falls back to:
 *   bodyWeightKg × fallbackMultiplier (same formula as before).
 */
export function getMcKgForExercise(
  exerciseName: string,
  bodyWeightKg: number,
  sex: Sex,
  fallbackMultiplier = 1,
): McResult {
  const norm = EXERCISE_NORMS[exerciseName];
  if (!norm) {
    return { kg: bodyWeightKg * fallbackMultiplier, source: "fallback" };
  }

  if (norm.kind === "time_based") {
    return { kg: null, source: "time" };
  }

  const ms = interpolateMs(bodyWeightKg, sex);

  if (norm.kind === "classic") {
    return { kg: ms[norm.lift], source: "classic" };
  }

  if (norm.kind === "coefficient") {
    return { kg: ms[norm.anchor] * norm.ratio, source: "coefficient" };
  }

  // bodyweight_ratio
  return { kg: bodyWeightKg * norm.ratio, source: "bodyweight" };
}

// ---------------------------------------------------------------------------
// Sport rank system
// ---------------------------------------------------------------------------

export type SportRankCode =
  | "NONE"
  | "YOUTH_III"
  | "YOUTH_II"
  | "YOUTH_I"
  | "III_RAZRYAD"
  | "II_RAZRYAD"
  | "I_RAZRYAD"
  | "KMS"
  | "MS";

export interface SportRank {
  code: SportRankCode;
  /** Full Russian label, e.g. "III юн. разряд", "КМС", "МС" */
  label: string;
  /** Short label for compact UI, e.g. "Юн III", "I р.", "КМС" */
  shortLabel: string;
  /** 0 (lowest) to 8 (highest) — for ordering and colour mapping */
  tier: number;
  /** Minimum level to display this rank on the ladder */
  minLevel: number;
}

/** Ordered from lowest to highest. */
const RANK_LADDER: SportRank[] = [
  { code: "NONE",        label: "Без разряда",    shortLabel: "Б/Р",    tier: 0, minLevel: 0  },
  { code: "YOUTH_III",   label: "III юн. разряд", shortLabel: "Юн III", tier: 1, minLevel: 10 },
  { code: "YOUTH_II",    label: "II юн. разряд",  shortLabel: "Юн II",  tier: 2, minLevel: 20 },
  { code: "YOUTH_I",     label: "I юн. разряд",   shortLabel: "Юн I",   tier: 3, minLevel: 30 },
  { code: "III_RAZRYAD", label: "III разряд",      shortLabel: "III р.", tier: 4, minLevel: 40 },
  { code: "II_RAZRYAD",  label: "II разряд",       shortLabel: "II р.",  tier: 5, minLevel: 50 },
  { code: "I_RAZRYAD",   label: "I разряд",        shortLabel: "I р.",   tier: 6, minLevel: 60 },
  { code: "KMS",         label: "КМС",             shortLabel: "КМС",    tier: 7, minLevel: 70 },
  { code: "MS",          label: "МС",              shortLabel: "МС",     tier: 8, minLevel: 76 },
];

/** Returns the sport rank that corresponds to a given level (0–80). */
export function rankForLevel(level: number): SportRank {
  let rank = RANK_LADDER[0]!;
  for (const r of RANK_LADDER) {
    if (level >= r.minLevel) rank = r;
  }
  return rank;
}

export { RANK_LADDER };
