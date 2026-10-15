import { z } from "zod";
import type { CreateCustomProgramExerciseInput, Equipment, PlannedExercise, ProgramPlan, Workout } from "@workspace/api-client-react";
import { durationOf, isTimedExercise, minimumWeight } from "./workoutMeasurement";
import { coachFieldsSchema, progressionSchema, type Progression } from "./trainingCoach";

export const setTargetSchema = z.object({
  weightKg: z.number().finite().nonnegative(),
  reps: z.number().int().nonnegative().safe(),
  durationSeconds: z.number().int().min(1).max(86400).optional(),
}).extend(coachFieldsSchema.shape).superRefine((set, ctx) => {
  if (set.durationSeconds != null) {
    if (set.weightKg !== 0) ctx.addIssue({ code: "custom", path: ["weightKg"], message: "Удержание учитывается в секундах, без веса." });
    if (set.reps !== 0) ctx.addIssue({ code: "custom", path: ["reps"], message: "Удержание учитывается в секундах, без повторов." });
    if (set.rir != null) ctx.addIssue({ code: "custom", path: ["rir"], message: "Запас повторений не применяется к удержанию." });
  } else if (set.reps <= 0) ctx.addIssue({ code: "custom", path: ["reps"], message: "Повторы: целое число от 1." });
});
export type SetTarget = z.infer<typeof setTargetSchema>;
export type TemplateExercise = PlannedExercise & Progression & { setTargets?: SetTarget[]; calibration?: boolean };
export type TemplatePlan = Omit<ProgramPlan, "exercises"> & { exercises: TemplateExercise[] };
export type TemplateInput = CreateCustomProgramExerciseInput & Progression & { setTargets?: SetTarget[] };

export const templateExerciseSchema = z.object({
  exerciseId: z.number().int().positive().safe(), sets: z.number().int().positive().safe(),
  repsMin: z.number().int().positive().safe(), repsMax: z.number().int().positive().safe(),
  intent: z.enum(["strength", "hypertrophy", "accessory"]), note: z.string().nullable().optional(),
  calibration: z.boolean().optional(),
  setTargets: z.array(setTargetSchema).min(1).optional(),
}).extend(progressionSchema.shape).passthrough().superRefine((item, ctx) => {
  if (item.repsMax < item.repsMin) ctx.addIssue({ code: "custom", path: ["repsMax"], message: "Верхняя граница должна быть не меньше нижней." });
  if (item.setTargets && item.setTargets.length !== item.sets) ctx.addIssue({ code: "custom", path: ["setTargets"], message: "Число подходов не совпадает с планом." });
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().max(200).optional(),
  exercises: z.array(templateExerciseSchema).min(1),
}).superRefine((input, ctx) => {
  const ids = new Set<number>();
  input.exercises.forEach((ex, index) => {
    if (ids.has(ex.exerciseId)) ctx.addIssue({ code: "custom", path: ["exercises", index, "exerciseId"], message: "Упражнение уже добавлено." });
    ids.add(ex.exerciseId);
  });
});

export function templateInputErrors(input: { name: string; description?: string; exercises: TemplateExercise[] }): Record<string, string> {
  const errors: Record<string, string> = {};
  const parsed = templateInputSchema.safeParse(input);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const field = issue.path.at(-1);
    const message = issue.code === "custom" ? issue.message : field === "name" ? input.name.trim() ? "Название: не больше 80 символов." : "Введите название тренировки."
      : field === "exercises" ? "Добавьте хотя бы одно упражнение."
      : field === "repsMin" || field === "repsMax" || field === "reps" ? "Повторы: целое число от 1."
      : field === "weightKg" ? "Укажите начальный рабочий вес."
      : field === "durationSeconds" ? "Время: целое число от 1 до 86400 с."
      : field === "weightStepKg" ? "Шаг веса: от 0,25 до 20 кг."
      : field === "targetRir" ? "Запас: целое число от 0 до 5."
      : "Проверьте значение.";
    errors[issue.path.join(".")] ??= message;
  }
  input.exercises.forEach((ex, index) => ex.setTargets?.forEach((set, setIndex) => {
    const path = `exercises.${index}.setTargets.${setIndex}`;
    if (isTimedExercise(ex.name)) {
      if (set.durationSeconds == null) errors[`${path}.durationSeconds`] = "Укажите время удержания в секундах.";
    } else {
      if (set.durationSeconds != null) errors[path] = "Для этого упражнения укажите вес и повторы, не время.";
      if (set.weightKg < minimumWeight(ex.equipment)) errors[`${path}.weightKg`] = `Вес со штангой: от ${minimumWeight(ex.equipment)} кг.`;
    }
  }));
  return errors;
}

export function validateTargets(exercise: { name: string; equipment: Equipment }, targets?: SetTarget[]) {
  if (!targets) return true;
  return targets.every(set => setTargetSchema.safeParse(set).success && (isTimedExercise(exercise.name)
    ? set.durationSeconds != null
    : set.durationSeconds == null && set.weightKg >= minimumWeight(exercise.equipment)));
}

export function templateFromWorkout(workout: Workout): TemplateInput[] {
  if (!workout.finishedAt || workout.sets.length === 0) throw new Error("Сначала завершите тренировку с подходами.");
  const groups = new Map<number, TemplateInput>();
  for (const set of workout.sets) {
    const timed = isTimedExercise(set.exerciseName);
    const seconds = durationOf(set);
    if (timed && seconds <= 0) throw new Error("В старой записи планки не указано время. Такой подход нельзя повторить как шаблон.");
    const target: SetTarget = { ...(timed ? { weightKg: 0, reps: 0, durationSeconds: seconds } : { weightKg: set.weightKg, reps: set.reps }), setType: "working" };
    const group = groups.get(set.exerciseId) ?? { exerciseId: set.exerciseId, sets: 0, repsMin: Infinity, repsMax: 0, intent: "hypertrophy", setTargets: [] };
    group.setTargets!.push(target);
    group.sets++;
    group.repsMin = Math.min(group.repsMin, timed ? seconds : set.reps);
    group.repsMax = Math.max(group.repsMax, timed ? seconds : set.reps);
    groups.set(set.exerciseId, group);
  }
  return [...groups.values()];
}

export function withSetTargets(exercise: TemplateExercise, targets: SetTarget[], keepRange = false): TemplateExercise {
  const values = targets.map(set => set.durationSeconds ?? set.reps);
  const workingValues = values;
  const valid = workingValues.length > 0 && workingValues.every(value => Number.isSafeInteger(value) && value > 0);
  return { ...exercise, setTargets: targets.map(set => ({ ...set, setType: "working" })), sets: targets.length,
    repsMin: keepRange ? valid ? Math.min(exercise.repsMin, ...workingValues) : exercise.repsMin : Math.min(...values),
    repsMax: keepRange ? valid ? Math.max(exercise.repsMax, ...workingValues) : exercise.repsMax : Math.max(...values),
    suggestedWeightKg: targets[0]?.weightKg ?? 0 };
}

export function editableTemplateExercise(exercise: TemplateExercise): TemplateExercise {
  return { ...withSetTargets(exercise, exercise.setTargets ?? Array.from({ length: exercise.sets }, (_, i) => plannedSet(exercise, i))), repsMin: exercise.repsMin, repsMax: exercise.repsMax };
}

export function plannedSet(exercise: TemplateExercise, completedSets: number): SetTarget {
  const target = exercise.setTargets?.[completedSets] ?? exercise.setTargets?.at(-1);
  if (target) return { ...target, setType: "working" };
  const reps = Math.round((exercise.repsMin + exercise.repsMax) / 2);
  return isTimedExercise(exercise.name)
    ? { weightKg: 0, reps: 0, durationSeconds: reps }
    : { weightKg: Math.max(minimumWeight(exercise.equipment), exercise.suggestedWeightKg), reps };
}

export function completedTargets(exercise: TemplateExercise, sets: Array<{ exerciseId: number }>): number {
  return Math.min(exercise.sets, sets.filter(set => set.exerciseId === exercise.exerciseId).length);
}

export function calibrateRemaining(exercise: TemplateExercise, performed: SetTarget, completed: number): TemplateExercise {
  if (!exercise.calibration || performed.durationSeconds != null || performed.rir == null || performed.technique == null) return exercise;
  const difficult = performed.technique === "breakdown" || performed.rir < 2;
  const easy = performed.technique === "good" && performed.rir >= 4;
  const min = minimumWeight(exercise.equipment);
  const bodyweight = exercise.equipment === "bodyweight" && performed.weightKg === 0;
  const weightKg = bodyweight ? 0 : Math.max(min, performed.weightKg + (difficult ? -2.5 : easy ? 2.5 : 0));
  const reduceReps = difficult && weightKg === performed.weightKg;
  const reps = Math.max(1, performed.reps + (reduceReps ? -Math.max(1, Math.ceil(performed.reps / 4)) : bodyweight && easy ? 1 : 0));
  const targets = exercise.setTargets?.map((set, i) => i < completed ? set : { ...set, weightKg, reps });
  return { ...exercise, calibration: false, ...(targets ? { setTargets: targets } : {}), suggestedWeightKg: weightKg,
    note: difficult && weightKg === min ? "Минимальная нагрузка. Если техника не сохраняется или есть боль, остановите упражнение и выберите более лёгкий вариант." : exercise.note };
}
