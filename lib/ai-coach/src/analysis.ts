import { z } from "zod";

const count = z.number().int().nonnegative().safe();
const id = z.number().int().positive().safe();
const text = z.string().min(1).max(500);
export const modelForecastSchema = z.object({
  version: z.literal("epley-rir-ema-v1"), status: z.enum(["ready", "insufficient", "unsupported", "stale"]),
  estimated1RMKg: z.number().finite().positive().nullable(), sessions: count,
  targetRir: z.number().int().min(0).max(5), source: z.enum(["history", "today"]).nullable(),
  validationSamples: count, repErrorMAE: z.number().finite().nonnegative().nullable(), rirErrorMAE: z.null(),
  fatigueBeta: z.number().finite().min(0).max(3).nullable(), fatigueSamples: count,
  unroundedWeightKg: z.number().finite().nonnegative().nullable(), predictedReps: z.number().finite().nonnegative().nullable(),
  targets: z.array(z.object({ weightKg: z.number().finite().nonnegative(), reps: id }).strict()).max(6),
  note: text,
}).strict();
export type ModelForecast = z.infer<typeof modelForecastSchema>;
export const analysisTotalsSchema = z.object({
  workouts: count, sets: count, reps: count, seconds: count, repSets: count,
  rirKnown: count, techniqueKnown: count, failureSets: count, breakdownSets: count,
  rirBuckets: z.array(count).length(7),
}).strict().refine(row => row.repSets <= row.sets && row.techniqueKnown <= row.sets && row.breakdownSets <= row.sets && row.rirKnown === row.rirBuckets.slice(0, 6).reduce((sum, n) => sum + n, 0) && row.repSets === row.rirBuckets.reduce((sum, n) => sum + n, 0) && row.failureSets === row.rirBuckets[0], "Inconsistent analysis totals");
export const trainingAnalysisSchema = z.object({
  version: z.literal(1), asOf: z.string().date(), from: z.string().date(),
  totals: analysisTotalsSchema,
  focus: z.object({ workoutId: id, totals: analysisTotalsSchema }).strict().nullable(),
  groups: z.array(z.object({ name: z.string().min(1).max(120), sets7: count, days7: count, sets28: count, days28: count }).strict()).max(40),
  exercises: z.array(z.object({
    key: z.string().min(1).max(100), exerciseId: id, name: z.string().min(1).max(120),
    equipment: z.enum(["barbell", "dumbbell", "bodyweight", "machine", "other"]),
    assisted: z.boolean(), dumbbellCount: z.union([z.literal(1), z.literal(2)]),
    matchesCurrentCategory: z.boolean(),
    range: z.object({ sets: id, repsMin: id, repsMax: id, source: z.enum(["template", "goal-default"]) }).strict(),
    workoutId: id, date: z.string().datetime({ offset: true }),
    sets: count, best: z.object({ weightKg: z.number().nonnegative(), reps: count, seconds: count }).strict(),
    comparison: z.object({ workoutId: id, weightKg: z.number().nonnegative(), previousReps: count, currentReps: count, comparableEffort: z.boolean() }).strict().nullable(),
    next: z.object({ weightKg: z.number().nonnegative(), reps: count, seconds: count,
      action: z.enum(["calibrate", "hold", "progress_reps", "increase", "reduce"]), reason: text }).strict(),
    model: modelForecastSchema.optional(),
  }).strict()).max(16),
  omittedExercises: count, limitations: z.array(text).max(12),
}).strict();
export type TrainingAnalysis = z.infer<typeof trainingAnalysisSchema>;
export const structuredReviewSchema = z.object({
  overview: text,
  progress: z.array(z.object({ exerciseKey: z.string().min(1).max(100), observation: text, interpretation: text, action: text }).strict()).max(8),
  workload: text, effort: text,
  priorities: z.array(z.object({ title: z.string().min(1).max(80), action: text, reason: text }).strict()).min(1).max(3),
  limitations: z.array(text).min(1).max(8),
}).strict();
export type StructuredReview = z.infer<typeof structuredReviewSchema>;
