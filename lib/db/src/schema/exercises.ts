import { pgTable, serial, text, boolean, timestamp, numeric, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const EQUIPMENT_VALUES = [
  "barbell",
  "dumbbell",
  "bodyweight",
  "machine",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT_VALUES)[number];

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group").notNull(),
  isCustom: boolean("is_custom").notNull().default(false),
  isMain: boolean("is_main").notNull().default(false),
  bodyweightMultiplier: numeric("bodyweight_multiplier", { precision: 5, scale: 2 })
    .notNull()
    .default("1.00"),
  equipment: text("equipment").notNull().default("other").$type<Equipment>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("exercises_user_custom_idx").on(table.userId, table.isCustom),
  index("exercises_muscle_name_idx").on(table.muscleGroup, table.name),
]);

export type Exercise = typeof exercisesTable.$inferSelect;
export type InsertExercise = typeof exercisesTable.$inferInsert;

/**
 * Per-user exercise preferences. Stores each user's personal isMain flag and
 * equipment choice for any exercise (global catalog or their own custom ones).
 * When a row exists here for (userId, exerciseId), these values take priority
 * over the global columns on exercisesTable.
 */
export const userExercisePrefsTable = pgTable("user_exercise_prefs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercisesTable.id, { onDelete: "cascade" }),
  isMain: boolean("is_main").notNull().default(false),
  equipment: text("equipment").$type<Equipment>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("user_exercise_prefs_user_exercise_idx").on(table.userId, table.exerciseId),
]);

export type UserExercisePref = typeof userExercisePrefsTable.$inferSelect;
export type InsertUserExercisePref = typeof userExercisePrefsTable.$inferInsert;
