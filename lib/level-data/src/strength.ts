// WRPF raw, drug-tested, open age class. Provenance and limitations: ../SOURCES.md.
export type Sex = "male" | "female";
export type Lift = "bench" | "squat" | "deadlift";
type Thresholds = readonly [number, number, number, number, number, number];
type Table = Record<Sex, readonly Thresholds[]>;

export const NORM_SOURCE_URL = "https://wrpf.pro/razryadnye-normativy-wrpf-wepf-waf-wsf/";
export const MAX_STRENGTH_LEVEL = 80;
export const DISCIPLINES = [
  { lift: "bench", name: "Жим штанги лёжа", muscleGroup: "Грудь" },
  { lift: "squat", name: "Приседания со штангой", muscleGroup: "Ноги" },
  { lift: "deadlift", name: "Становая тяга", muscleGroup: "Спина" },
] as const;

const CLASSES = {
  male: [52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140],
  female: [44, 48, 52, 56, 60, 67.5, 75, 82.5, 90],
};

// Columns: MSMC, MS, KMS, I, II, III. Final row is the open-ended category.
const TABLES: Record<Lift, Table> = {
  bench: {
    male: [
      [110,95,82.5,75,67.5,57.5], [120,102.5,90,80,72.5,62.5],
      [127.5,112.5,97.5,87.5,77.5,67.5], [142.5,125,107.5,97.5,87.5,75],
      [155,135,117.5,105,95,82.5], [167.5,145,127.5,112.5,102.5,87.5],
      [175,152.5,132.5,120,107.5,92.5], [185,162.5,140,125,112.5,97.5],
      [195,167.5,147.5,132.5,117.5,100], [202.5,177.5,152.5,137.5,122.5,105],
      [210,182.5,157.5,142.5,127.5,110], [215,187.5,162.5,145,130,112.5],
    ],
    female: [
      [55,47.5,40,37.5,32.5,27.5], [60,52.5,45,40,37.5,32.5],
      [67.5,57.5,50,45,40,35], [72.5,62.5,55,47.5,42.5,37.5],
      [77.5,67.5,57.5,52.5,47.5,40], [85,75,65,57.5,52.5,45],
      [92.5,80,70,62.5,57.5,47.5], [97.5,85,75,67.5,60,52.5],
      [102.5,90,77.5,70,62.5,55], [107.5,92.5,80,72.5,65,57.5],
    ],
  },
  squat: {
    male: [
      [162.5,140,120,102.5,92.5,77.5], [175,150,130,112.5,102.5,85],
      [187.5,160,137.5,120,107.5,92.5], [207.5,180,155,135,122.5,102.5],
      [222.5,192.5,167.5,145,132.5,112.5], [235,205,175,152.5,140,117.5],
      [247.5,215,187.5,162.5,147.5,125], [260,225,195,170,155,132.5],
      [267.5,232.5,200,175,160,137.5], [280,242.5,210,185,170,145],
      [287.5,250,217.5,190,175,150], [295,255,222.5,195,180,155],
    ],
    female: [
      [95,80,67.5,60,52.5,40], [107.5,90,77.5,65,57.5,45],
      [115,97.5,82.5,72.5,62.5,50], [125,105,90,77.5,67.5,55],
      [130,112.5,95,82.5,72.5,60], [140,120,102.5,90,80,65],
      [150,127.5,107.5,95,82.5,67.5], [155,135,115,100,87.5,72.5],
      [162.5,137.5,117.5,102.5,90,75], [167.5,142.5,122.5,107.5,92.5,77.5],
    ],
  },
  deadlift: {
    male: [
      [177.5,155,135,117.5,107.5,92.5], [190,165,145,127.5,117.5,100],
      [202.5,175,152.5,135,122.5,107.5], [222.5,195,170,150,137.5,117.5],
      [237.5,207.5,182.5,160,147.5,127.5], [250,220,190,167.5,155,132.5],
      [262.5,230,202.5,177.5,162.5,140], [275,240,210,185,170,147.5],
      [282.5,247.5,215,190,175,152.5], [295,257.5,225,200,182.5,160],
      [302.5,265,232.5,202.5,190,162.5], [310,270,237.5,207.5,197.5,165],
    ],
    female: [
      [115,100,87.5,80,72.5,62.5], [127.5,110,97.5,85,77.5,65],
      [135,117.5,102.5,92.5,85,70], [145,125,110,97.5,87.5,75],
      [150,132.5,115,102.5,92.5,80], [160,140,122.5,110,100,85],
      [170,147.5,127.5,115,102.5,87.5], [175,155,135,120,107.5,92.5],
      [182.5,157.5,137.5,122.5,110,95], [187.5,162.5,142.5,127.5,112.5,97.5],
    ],
  },
};

export const WRPF_RANKS = [
  { code: "NONE", label: "Без разряда", shortLabel: "Б/Р", tier: 0, minLevel: 0 },
  { code: "III_RAZRYAD", label: "III разряд", shortLabel: "III р.", tier: 4, minLevel: 14 },
  { code: "II_RAZRYAD", label: "II разряд", shortLabel: "II р.", tier: 5, minLevel: 27 },
  { code: "I_RAZRYAD", label: "I разряд", shortLabel: "I р.", tier: 6, minLevel: 40 },
  { code: "KMS", label: "КМС", shortLabel: "КМС", tier: 7, minLevel: 54 },
  { code: "MS", label: "МС", shortLabel: "МС", tier: 8, minLevel: 67 },
  { code: "MSMC", label: "МСМК", shortLabel: "МСМК", tier: 9, minLevel: 80 },
] as const;

export function weightClass(bodyWeightKg: number, sex: Sex) {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) throw new Error("Invalid body weight");
  const classes = CLASSES[sex];
  const index = classes.findIndex(kg => bodyWeightKg <= kg);
  const open = index === -1;
  const kg = classes[open ? classes.length - 1 : index]!;
  return { index: open ? classes.length : index, kg, open, label: `${kg}${open ? "+" : ""}` };
}

export function liftForExercise(name: string): Lift | null {
  return DISCIPLINES.find(item => item.name === name)?.lift ?? null;
}

export function rankNorms(lift: Lift, bodyWeightKg: number, sex: Sex) {
  const row = TABLES[lift][sex][weightClass(bodyWeightKg, sex).index]!;
  return WRPF_RANKS.map((rank, index) => ({ rank, kgTarget: index === 0 ? 0 : row[6 - index]! }));
}

export function msmcTarget(lift: Lift, bodyWeightKg: number, sex: Sex): number {
  return TABLES[lift][sex][weightClass(bodyWeightKg, sex).index]![0];
}

export function rankForGameLevel(level: number) {
  return WRPF_RANKS.reduce((best, rank) => level >= rank.minLevel ? rank : best, WRPF_RANKS[0] as typeof WRPF_RANKS[number]);
}

export function requiredStrengthKg(lift: Lift, level: number, bodyWeightKg: number, sex: Sex): number {
  if (level <= 0) return 0;
  const norms = rankNorms(lift, bodyWeightKg, sex);
  const anchors = [{ level: 1, kg: 20 }, ...norms.slice(1).map(entry => ({ level: entry.rank.minLevel, kg: entry.kgTarget }))];
  const targetLevel = Math.min(80, level);
  const upperIndex = anchors.findIndex(anchor => anchor.level >= targetLevel);
  if (upperIndex === 0) return 20;
  const lower = anchors[upperIndex - 1]!;
  const upper = anchors[upperIndex]!;
  // Game steps bridge adjacent published rank thresholds; ranks themselves use exact table values.
  const kg = lower.kg + (upper.kg - lower.kg) * (targetLevel - lower.level) / (upper.level - lower.level);
  return Math.max(20, Math.ceil(kg / 2.5 - 1e-9) * 2.5);
}

export function strengthLevel(results: Record<Lift, number>, bodyWeightKg: number, sex: Sex): number {
  for (let level = 80; level > 0; level--) {
    if (DISCIPLINES.every(({ lift }) => results[lift] >= requiredStrengthKg(lift, level, bodyWeightKg, sex))) return level;
  }
  return 0;
}

export function rankForLift(lift: Lift, weightKg: number, bodyWeightKg: number, sex: Sex) {
  return rankNorms(lift, bodyWeightKg, sex).reduce((best, entry) => weightKg >= entry.kgTarget ? entry.rank : best, WRPF_RANKS[0] as typeof WRPF_RANKS[number]);
}
