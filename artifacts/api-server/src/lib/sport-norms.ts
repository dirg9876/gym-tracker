/**
 * Sport standards and rank definitions for the gym tracker level system.
 *
 * МСМК (Мастер спорта международного класса) standards:
 *   Big-3 (squat/bench/deadlift) — WRPF (World Raw Powerlifting Federation),
 *   классический пауэрлифтинг raw (с допинг-контролем).
 *   Источник: https://frs24.ru (WRPF нормативы)
 *
 * All other exercises: empirical coefficients relative to the bench press МСМК
 *   target, based on Strength Level Elite-tier ratios (≈ МСМК equivalent).
 *   These are NOT official norms — they are coaching-table approximations.
 */

export type Sex = "male" | "female";

// ---------------------------------------------------------------------------
// МСМК standards by weight class (WRPF, с допинг-контролем)
// ---------------------------------------------------------------------------

interface MsmcRow {
  weightClassKg: number;
  squat: number;
  bench: number;
  deadlift: number;
}

/**
 * Classic raw powerlifting МСМК standards (men, women) — WRPF.
 * The last entry in each array represents the "over" (open) weight class;
 * its weightClassKg is a practical anchor for interpolation purposes only.
 */
const MS_STANDARDS: Record<Sex, MsmcRow[]> = {
  male: [
    { weightClassKg: 52,  squat: 162.5, bench: 110,   deadlift: 177.5 },
    { weightClassKg: 56,  squat: 175,   bench: 120,   deadlift: 190   },
    { weightClassKg: 60,  squat: 187.5, bench: 127.5, deadlift: 202.5 },
    { weightClassKg: 67.5,squat: 207.5, bench: 142.5, deadlift: 222.5 },
    { weightClassKg: 75,  squat: 222.5, bench: 155,   deadlift: 237.5 },
    { weightClassKg: 82.5,squat: 235,   bench: 167.5, deadlift: 250   },
    { weightClassKg: 90,  squat: 247.5, bench: 175,   deadlift: 262.5 },
    { weightClassKg: 100, squat: 260,   bench: 185,   deadlift: 275   },
    { weightClassKg: 110, squat: 267.5, bench: 195,   deadlift: 282.5 },
    { weightClassKg: 125, squat: 280,   bench: 202.5, deadlift: 295   },
    { weightClassKg: 140, squat: 287.5, bench: 210,   deadlift: 302.5 },
    { weightClassKg: 150, squat: 295,   bench: 215,   deadlift: 310   }, // 140+ class
  ],
  female: [
    { weightClassKg: 44,  squat: 95,    bench: 55,    deadlift: 115   },
    { weightClassKg: 48,  squat: 107.5, bench: 60,    deadlift: 127.5 },
    { weightClassKg: 52,  squat: 115,   bench: 67.5,  deadlift: 135   },
    { weightClassKg: 56,  squat: 125,   bench: 72.5,  deadlift: 145   },
    { weightClassKg: 60,  squat: 130,   bench: 77.5,  deadlift: 150   },
    { weightClassKg: 67.5,squat: 140,   bench: 85,    deadlift: 160   },
    { weightClassKg: 75,  squat: 150,   bench: 92.5,  deadlift: 170   },
    { weightClassKg: 82.5,squat: 155,   bench: 97.5,  deadlift: 175   },
    { weightClassKg: 90,  squat: 162.5, bench: 102.5, deadlift: 182.5 },
    { weightClassKg: 110, squat: 167.5, bench: 107.5, deadlift: 187.5 }, // 90+ class
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
 * Returns interpolated МСМК kg values for the three classic lifts.
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
 * "classic" — uses the official МСМК table directly.
 * "coefficient" — ratio of an anchor classic lift's МСМК value.
 * "bodyweight_ratio" — ratio of the athlete's bodyweight (e.g. weighted pull-ups).
 * "time_based" — time-based target, no kg norm.
 */
const EXERCISE_NORMS: Record<string, NormConfig> = {
  // Big 3 — official МСМК standards
  "Приседания со штангой":          { kind: "classic",      lift: "squat" },
  "Жим штанги лёжа":                { kind: "classic",      lift: "bench" },
  "Становая тяга":                  { kind: "classic",      lift: "deadlift" },

  // Barbell accessories — coefficient of bench/deadlift МСМК
  "Жим штанги на наклонной скамье": { kind: "coefficient",  anchor: "bench",    ratio: 0.85 },
  "Тяга штанги в наклоне":          { kind: "coefficient",  anchor: "bench",    ratio: 0.85 },
  "Жим штанги стоя":                { kind: "coefficient",  anchor: "bench",    ratio: 0.65 },
  "Подъём штанги на бицепс":        { kind: "coefficient",  anchor: "bench",    ratio: 0.50 },
  "Румынская тяга":                 { kind: "coefficient",  anchor: "deadlift", ratio: 0.75 },
  "Французский жим":                { kind: "coefficient",  anchor: "bench",    ratio: 0.55 },

  // Dumbbell — per-dumbbell target, coefficient of bench/squat МСМК
  "Жим гантелей лёжа":              { kind: "coefficient",  anchor: "bench",    ratio: 0.40 },
  "Жим гантелей сидя":              { kind: "coefficient",  anchor: "bench",    ratio: 0.30 },
  "Тяга гантели одной рукой":       { kind: "coefficient",  anchor: "bench",    ratio: 0.45 },
  "Разводка гантелей":              { kind: "coefficient",  anchor: "bench",    ratio: 0.25 },
  "Махи гантелями в стороны":       { kind: "coefficient",  anchor: "bench",    ratio: 0.12 },
  "Махи в наклоне":                 { kind: "coefficient",  anchor: "bench",    ratio: 0.12 },
  "Сгибания с гантелями":           { kind: "coefficient",  anchor: "bench",    ratio: 0.28 },
  "Молотки с гантелями":            { kind: "coefficient",  anchor: "bench",    ratio: 0.28 },
  "Выпады с гантелями":             { kind: "coefficient",  anchor: "squat",    ratio: 0.25 },

  // Machine / cable — coefficient of bench or squat МСМК
  "Тяга верхнего блока":            { kind: "coefficient",  anchor: "bench",    ratio: 0.75 },
  "Тяга горизонтального блока":     { kind: "coefficient",  anchor: "bench",    ratio: 0.75 },
  "Разгибания на блоке":            { kind: "coefficient",  anchor: "bench",    ratio: 0.40 },
  "Жим ногами":                     { kind: "coefficient",  anchor: "squat",    ratio: 1.80 },
  "Сгибания ног лёжа":              { kind: "coefficient",  anchor: "squat",    ratio: 0.35 },
  "Разгибания ног сидя":            { kind: "coefficient",  anchor: "squat",    ratio: 0.45 },
  "Подъёмы на носки":               { kind: "coefficient",  anchor: "squat",    ratio: 0.60 },

  // Bodyweight — total weight (bodyweight + extra load) ratio at МСМК
  // Rep-based norms are in BODYWEIGHT_NORMS below; these ratios are kept for
  // tonnage / level-requirement calculations only.
  "Подтягивания":                   { kind: "bodyweight_ratio", ratio: 1.65 },
  "Отжимания узким хватом":         { kind: "bodyweight_ratio", ratio: 1.00 },
  "Отжимания на брусьях":           { kind: "bodyweight_ratio", ratio: 1.30 },

  // Time-based — no kg requirement
  "Планка":                         { kind: "time_based", secondsAtMS: 60 },
  "Скручивания":                    { kind: "time_based", secondsAtMS: 60 },
  "Подъём ног в висе":              { kind: "time_based", secondsAtMS: 60 },
};

// ---------------------------------------------------------------------------
// Muscle-group anchor fallback
// ---------------------------------------------------------------------------

/**
 * For exercises not found in EXERCISE_NORMS, maps the exercise's muscle group
 * to a classic lift anchor + ratio. Used as an intermediate fallback before
 * the raw bodyweight multiplier.
 * null means the group has no useful kg norm (e.g. core/abs).
 */
const MUSCLE_GROUP_ANCHORS: Record<
  string,
  { anchor: "squat" | "bench" | "deadlift"; ratio: number } | null
> = {
  "Грудь":      { anchor: "bench",    ratio: 0.80 },
  "Спина":      { anchor: "deadlift", ratio: 0.70 },
  "Ноги":       { anchor: "squat",    ratio: 0.80 },
  "Плечи":      { anchor: "bench",    ratio: 0.55 },
  "Бицепс":     { anchor: "bench",    ratio: 0.45 },
  "Трицепс":    { anchor: "bench",    ratio: 0.50 },
  "Пресс":      null,
  "Икры":       { anchor: "squat",    ratio: 0.60 },
  "Предплечья": { anchor: "bench",    ratio: 0.35 },
  // English aliases
  "Chest":      { anchor: "bench",    ratio: 0.80 },
  "Back":       { anchor: "deadlift", ratio: 0.70 },
  "Legs":       { anchor: "squat",    ratio: 0.80 },
  "Shoulders":  { anchor: "bench",    ratio: 0.55 },
  "Biceps":     { anchor: "bench",    ratio: 0.45 },
  "Triceps":    { anchor: "bench",    ratio: 0.50 },
  "Core":       null,
  "Calves":     { anchor: "squat",    ratio: 0.60 },
};

// ---------------------------------------------------------------------------
// Public helper
// ---------------------------------------------------------------------------

export type McSource =
  | "classic"
  | "coefficient"
  | "bodyweight"
  | "time"
  | "fallback"
  | "muscle_group_anchor";

export type McResult = {
  /** МСМК-equivalent kg for this exercise. null for time-based exercises. */
  kg: number | null;
  source: McSource;
};

/**
 * Returns the МСМК (Мастер спорта международного класса) equivalent kg target
 * for an exercise, given the athlete's bodyweight and sex.
 *
 * Lookup order:
 *  1. EXERCISE_NORMS exact name match.
 *  2. MUSCLE_GROUP_ANCHORS (muscle-group coefficient) — only when muscleGroup provided.
 *  3. bodyWeightKg × fallbackMultiplier.
 */
export function getMcKgForExercise(
  exerciseName: string,
  bodyWeightKg: number,
  sex: Sex,
  fallbackMultiplier = 1,
  muscleGroup?: string,
): McResult {
  const norm = EXERCISE_NORMS[exerciseName];
  if (norm) {
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

  // Try muscle-group anchor before the raw bodyweight fallback
  if (muscleGroup !== undefined) {
    if (Object.prototype.hasOwnProperty.call(MUSCLE_GROUP_ANCHORS, muscleGroup)) {
      const anchor = MUSCLE_GROUP_ANCHORS[muscleGroup];
      if (anchor === null) {
        return { kg: null, source: "time" };
      }
      const ms = interpolateMs(bodyWeightKg, sex);
      return { kg: ms[anchor.anchor] * anchor.ratio, source: "muscle_group_anchor" };
    }
  }

  return { kg: bodyWeightKg * fallbackMultiplier, source: "fallback" };
}

// ---------------------------------------------------------------------------
// Rank norms ladder
// ---------------------------------------------------------------------------

/**
 * Returns the full 10-step rank threshold array for an exercise given its mcKg.
 * Each entry gives the minimum kg lift needed to reach that rank.
 * Thresholds mirror rankForMcPercent boundaries; kgTarget rounded to 2.5 kg.
 */
export function getRankNormsForExercise(
  mcKg: number,
): Array<{ rank: SportRank; kgTarget: number }> {
  const THRESHOLDS: Array<{ pct: number; rankIdx: number }> = [
    { pct: 0.00, rankIdx: 0 }, // Без разряда
    { pct: 0.10, rankIdx: 1 }, // Юн III
    { pct: 0.22, rankIdx: 2 }, // Юн II
    { pct: 0.35, rankIdx: 3 }, // Юн I
    { pct: 0.52, rankIdx: 4 }, // III разряд
    { pct: 0.59, rankIdx: 5 }, // II разряд
    { pct: 0.67, rankIdx: 6 }, // I разряд
    { pct: 0.75, rankIdx: 7 }, // КМС
    { pct: 0.87, rankIdx: 8 }, // МС
    { pct: 0.95, rankIdx: 9 }, // МСМК
  ];

  return THRESHOLDS.map(({ pct, rankIdx }) => ({
    rank: RANK_LADDER[rankIdx]!,
    kgTarget: Math.round((mcKg * pct) / 2.5) * 2.5,
  }));
}

// ---------------------------------------------------------------------------
// Bodyweight exercise rep norms
// ---------------------------------------------------------------------------

/**
 * A single rank threshold for a bodyweight exercise.
 * Reps ≤ 30. When extraKg > 0, reps is always 30 (the athlete must do 30 reps
 * AND hold the given extra weight).
 */
export interface BwNormEntry {
  /** Minimum reps required in one set (at bodyweight, no extra). Max 30. */
  reps: number;
  /** Extra load (kg) beyond bodyweight. 0 for rep-only tiers. */
  extraKg: number;
}

/**
 * Rep/weight thresholds for bodyweight exercises, indexed by RANK_LADDER
 * (0 = NONE … 9 = МСМК). Ten entries per sex.
 *
 * Design rule: reps cap at 30; ranks beyond 30 require additional weight.
 */
export const BODYWEIGHT_REP_NORMS: Record<
  string,
  { male: BwNormEntry[]; female: BwNormEntry[] }
> = {
  "Подтягивания": {
    male: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 6,  extraKg: 0  }, // Юн III
      { reps: 10, extraKg: 0  }, // Юн II
      { reps: 15, extraKg: 0  }, // Юн I
      { reps: 20, extraKg: 0  }, // III р.
      { reps: 25, extraKg: 0  }, // II р.
      { reps: 30, extraKg: 0  }, // I р.
      { reps: 30, extraKg: 10 }, // КМС
      { reps: 30, extraKg: 22 }, // МС
      { reps: 30, extraKg: 38 }, // МСМК
    ],
    female: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 3,  extraKg: 0  }, // Юн III
      { reps: 6,  extraKg: 0  }, // Юн II
      { reps: 10, extraKg: 0  }, // Юн I
      { reps: 14, extraKg: 0  }, // III р.
      { reps: 18, extraKg: 0  }, // II р.
      { reps: 22, extraKg: 0  }, // I р.
      { reps: 30, extraKg: 0  }, // КМС
      { reps: 30, extraKg: 8  }, // МС
      { reps: 30, extraKg: 18 }, // МСМК
    ],
  },
  "Отжимания на брусьях": {
    male: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 10, extraKg: 0  }, // Юн III
      { reps: 15, extraKg: 0  }, // Юн II
      { reps: 20, extraKg: 0  }, // Юн I
      { reps: 25, extraKg: 0  }, // III р.
      { reps: 30, extraKg: 0  }, // II р.
      { reps: 30, extraKg: 10 }, // I р.
      { reps: 30, extraKg: 20 }, // КМС
      { reps: 30, extraKg: 35 }, // МС
      { reps: 30, extraKg: 50 }, // МСМК
    ],
    female: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 6,  extraKg: 0  }, // Юн III
      { reps: 10, extraKg: 0  }, // Юн II
      { reps: 15, extraKg: 0  }, // Юн I
      { reps: 20, extraKg: 0  }, // III р.
      { reps: 25, extraKg: 0  }, // II р.
      { reps: 30, extraKg: 0  }, // I р.
      { reps: 30, extraKg: 8  }, // КМС
      { reps: 30, extraKg: 18 }, // МС
      { reps: 30, extraKg: 28 }, // МСМК
    ],
  },
  "Отжимания узким хватом": {
    male: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 12, extraKg: 0  }, // Юн III
      { reps: 18, extraKg: 0  }, // Юн II
      { reps: 22, extraKg: 0  }, // Юн I
      { reps: 26, extraKg: 0  }, // III р.
      { reps: 30, extraKg: 0  }, // II р.
      { reps: 30, extraKg: 8  }, // I р.
      { reps: 30, extraKg: 18 }, // КМС
      { reps: 30, extraKg: 30 }, // МС
      { reps: 30, extraKg: 45 }, // МСМК
    ],
    female: [
      { reps: 1,  extraKg: 0  }, // NONE
      { reps: 8,  extraKg: 0  }, // Юн III
      { reps: 13, extraKg: 0  }, // Юн II
      { reps: 17, extraKg: 0  }, // Юн I
      { reps: 21, extraKg: 0  }, // III р.
      { reps: 25, extraKg: 0  }, // II р.
      { reps: 30, extraKg: 0  }, // I р.
      { reps: 30, extraKg: 6  }, // КМС
      { reps: 30, extraKg: 14 }, // МС
      { reps: 30, extraKg: 22 }, // МСМК
    ],
  },
};

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
  | "MS"
  | "MSMC";

export interface SportRank {
  code: SportRankCode;
  /** Full Russian label, e.g. "III юн. разряд", "КМС", "МС", "МСМК" */
  label: string;
  /** Short label for compact UI, e.g. "Юн III", "I р.", "КМС", "МСМК" */
  shortLabel: string;
  /** 0 (lowest) to 9 (highest) — for ordering and colour mapping */
  tier: number;
  /** Minimum level to display this rank on the ladder */
  minLevel: number;
}

/**
 * Ordered from lowest to highest.
 * minLevel = ceil(pct × 80) where pct matches rankForMcPercent thresholds,
 * so the level-based display is consistent with the percent-based rank system.
 *   YOUTH_III: ceil(0.10 × 80) = 8
 *   YOUTH_II:  ceil(0.22 × 80) = 18
 *   YOUTH_I:   ceil(0.35 × 80) = 28
 *   III р.:    ceil(0.52 × 80) = 42
 *   II р.:     ceil(0.59 × 80) = 48  (47.2 → 48)
 *   I р.:      ceil(0.67 × 80) = 54  (53.6 → 54)
 *   КМС:       ceil(0.75 × 80) = 60
 *   МС:        ceil(0.87 × 80) = 70  (69.6 → 70)
 *   МСМК:      minLevel 78 (per task spec; 0.95 × 80 = 76, rounded up to 78)
 */
const RANK_LADDER: SportRank[] = [
  { code: "NONE",        label: "Без разряда",    shortLabel: "Б/Р",    tier: 0, minLevel: 0  },
  { code: "YOUTH_III",   label: "III юн. разряд", shortLabel: "Юн III", tier: 1, minLevel: 8  },
  { code: "YOUTH_II",    label: "II юн. разряд",  shortLabel: "Юн II",  tier: 2, minLevel: 18 },
  { code: "YOUTH_I",     label: "I юн. разряд",   shortLabel: "Юн I",   tier: 3, minLevel: 28 },
  { code: "III_RAZRYAD", label: "III разряд",      shortLabel: "III р.", tier: 4, minLevel: 42 },
  { code: "II_RAZRYAD",  label: "II разряд",       shortLabel: "II р.",  tier: 5, minLevel: 48 },
  { code: "I_RAZRYAD",   label: "I разряд",        shortLabel: "I р.",   tier: 6, minLevel: 54 },
  { code: "KMS",         label: "КМС",             shortLabel: "КМС",    tier: 7, minLevel: 60 },
  { code: "MS",          label: "МС",              shortLabel: "МС",     tier: 8, minLevel: 70 },
  { code: "MSMC",        label: "МСМК",            shortLabel: "МСМК",   tier: 9, minLevel: 78 },
];

/** Returns the sport rank that corresponds to a given level (0–80). */
export function rankForLevel(level: number): SportRank {
  let rank = RANK_LADDER[0]!;
  for (const r of RANK_LADDER) {
    if (level >= r.minLevel) rank = r;
  }
  return rank;
}

/**
 * Returns the sport rank corresponding to a performance ratio relative to the
 * МСМК standard (0.0 = nothing, 1.0 = full МСМК).
 */
export function rankForMcPercent(pct: number): SportRank {
  if (pct >= 0.95) return RANK_LADDER[9]!; // МСМК
  if (pct >= 0.87) return RANK_LADDER[8]!; // МС
  if (pct >= 0.75) return RANK_LADDER[7]!; // КМС
  if (pct >= 0.67) return RANK_LADDER[6]!; // I разряд
  if (pct >= 0.59) return RANK_LADDER[5]!; // II разряд
  if (pct >= 0.52) return RANK_LADDER[4]!; // III разряд
  if (pct >= 0.35) return RANK_LADDER[3]!; // Юн I
  if (pct >= 0.22) return RANK_LADDER[2]!; // Юн II
  if (pct >= 0.10) return RANK_LADDER[1]!; // Юн III
  return RANK_LADDER[0]!;                  // Без разряда
}

export { RANK_LADDER };
