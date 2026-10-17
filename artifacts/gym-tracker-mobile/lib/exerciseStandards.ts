import type { Exercise, Profile } from "@workspace/api-client-react";
import { DISCIPLINES, liftForExercise, rankNorms, WRPF_RANKS, type Lift } from "@workspace/level-data/strength";
import { isTimedExercise } from "./workoutMeasurement";
import { isAssisted, type EquipmentSettings } from "./equipmentSettings";

type Rank = typeof WRPF_RANKS[number];
export type StandardUnit = "kg" | "reps" | "seconds";
export type ExerciseStandard = {
  official: boolean; unit: StandardUnit; description: string;
  entries: { rank: Rank; target: number }[];
};
export type RankedExercise = Exercise & { rankBest?: number; standard?: ExerciseStandard };

// Existing repository coefficients, applied to each actual rank threshold.
const COEFFICIENTS: Record<string, [Lift, number]> = {
  "Жим штанги на наклонной скамье": ["bench", .85], "Тяга штанги в наклоне": ["bench", .85],
  "Жим штанги стоя": ["bench", .65], "Подъём штанги на бицепс": ["bench", .50],
  "Румынская тяга": ["deadlift", .75], "Французский жим": ["bench", .55],
  "Жим гантелей лёжа": ["bench", .28], "Жим гантелей сидя": ["bench", .22],
  "Тяга гантели одной рукой": ["bench", .37], "Разводка гантелей": ["bench", .18],
  "Махи гантелями в стороны": ["bench", .10], "Махи в наклоне": ["bench", .10],
  "Сгибания с гантелями": ["bench", .20], "Молотки с гантелями": ["bench", .20],
  "Выпады с гантелями": ["squat", .20], "Тяга верхнего блока": ["bench", .75],
  "Тяга горизонтального блока": ["bench", .75], "Разгибания на блоке": ["bench", .40],
  "Жим ногами": ["squat", 1.80], "Сгибания ног лёжа": ["squat", .35],
  "Разгибания ног сидя": ["squat", .45], "Подъёмы на носки": ["squat", .60],
};
const GROUPS: Record<string, [Lift, number]> = {
  "Грудь": ["bench", .8], "Спина": ["deadlift", .7], "Ноги": ["squat", .8],
  "Плечи": ["bench", .55], "Бицепс": ["bench", .45], "Трицепс": ["bench", .5],
  "Икры": ["squat", .6], "Пресс": ["squat", .25],
};

export function exerciseStandard(exercise: Exercise & EquipmentSettings, profile: Profile): ExerciseStandard {
  const sex = profile.sex ?? "male";
  const kg = profile.bodyWeightKg ?? 75;
  const ranks = WRPF_RANKS.slice(1);
  if (isTimedExercise(exercise.name)) {
    return { official: false, unit: "seconds", description: "Условная шкала времени удержания. Не спортивный разряд WRPF.", entries: ranks.map((rank, i) => ({ rank, target: [30,45,60,90,120,180][i] })) };
  }
  if (exercise.equipment === "bodyweight") {
    const base = sex === "female" ? [2,4,6,8,10,15] : [5,8,12,16,20,25];
    const ratios: Record<string, number> = { "Подтягивания": 1, "Отжимания на брусьях": 1.5, "Отжимания узким хватом": 2, "Скручивания": 3, "Подъём ног в висе": 1.2 };
    const ratio = ratios[exercise.name] ?? 1;
    return { official: false, unit: "reps", description: `Условная шкала повторов за один подход: подтягивания × ${String(ratio).replace(".", ",")}. Не норматив WRPF.`, entries: ranks.map((rank, i) => ({ rank, target: Math.ceil(base[i] * ratio) })) };
  }
  const lift = exercise.equipment === "barbell" && !exercise.isCustom ? liftForExercise(exercise.name) : null;
  const official = lift != null;
  const known = COEFFICIENTS[exercise.name];
  const fallback = GROUPS[exercise.muscleGroup] ?? ["bench", .5];
  const [anchor, ratio] = lift ? [lift, 1] : known ?? [fallback[0], fallback[1] * (exercise.equipment === "dumbbell" ? .5 : 1)];
  const entries = rankNorms(anchor as Lift, kg, sex).slice(1).map(({ rank, kgTarget }) => ({ rank, target: official ? kgTarget : Math.max(exercise.equipment === "barbell" ? 20 : 2.5, Math.ceil((kgTarget * Number(ratio)) / 2.5 - 1e-9) * 2.5) }));
  const anchorName = DISCIPLINES.find(item => item.lift === anchor)!.name;
  return {
    official, unit: "kg", entries,
    description: official ? "WRPF: без экипировки, с допинг-контролем. Сравнение результата, не присвоение звания."
      : `${anchorName} × ${String(ratio).replace(".", ",")}${exercise.equipment === "dumbbell" ? "; вес одной гантели" : ""}. Расчётный ориентир, не норматив WRPF.${isAssisted(exercise) ? " Сравнивается масса тела минус противовес, не вес противовеса." : ""}${exercise.equipment === "machine" ? " Зависит от конструкции тренажёра." : ""}${!known ? " Коэффициент выбран по группе мышц." : ""}`,
  };
}

export function standardProgress(standard: ExerciseStandard, value: number) {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  const current = standard.entries.filter(entry => safe >= entry.target).at(-1) ?? null;
  const next = standard.entries.find(entry => safe < entry.target);
  const target = next ?? standard.entries.at(-1)!;
  return { ...target, current, remaining: Math.max(0, Math.round((target.target - safe) * 100) / 100), atMaximum: !next, standard };
}

export function formatStandard(value: number, unit: StandardUnit) {
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${unit === "kg" ? "кг" : unit === "seconds" ? "с" : "повт."}`;
}
