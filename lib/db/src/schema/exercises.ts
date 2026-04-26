import { pgTable, serial, text, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

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
});

export type Exercise = typeof exercisesTable.$inferSelect;
export type InsertExercise = typeof exercisesTable.$inferInsert;
