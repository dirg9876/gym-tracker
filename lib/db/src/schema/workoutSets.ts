import {
  pgTable,
  serial,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { workoutsTable } from "./workouts";
import { exercisesTable } from "./exercises";

export const workoutSetsTable = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workoutsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercisesTable.id, { onDelete: "restrict" }),
  weightKg: numeric("weight_kg", { precision: 7, scale: 2 }).notNull(),
  reps: integer("reps").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
export type InsertWorkoutSet = typeof workoutSetsTable.$inferInsert;
