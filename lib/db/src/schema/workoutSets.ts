import {
  pgTable,
  serial,
  integer,
  index,
  numeric,
  text,
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
  userId: text("user_id"),
  weightKg: numeric("weight_kg", { precision: 7, scale: 2 }).notNull(),
  reps: integer("reps").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("workout_sets_workout_created_idx").on(table.workoutId, table.createdAt),
  index("workout_sets_exercise_created_idx").on(table.exerciseId, table.createdAt),
  index("workout_sets_user_exercise_idx").on(table.userId, table.exerciseId),
]);

export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
export type InsertWorkoutSet = typeof workoutSetsTable.$inferInsert;
