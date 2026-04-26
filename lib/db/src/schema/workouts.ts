import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  index("workouts_user_started_idx").on(table.userId, table.startedAt),
  index("workouts_user_finished_idx").on(table.userId, table.finishedAt),
]);

export type Workout = typeof workoutsTable.$inferSelect;
export type InsertWorkout = typeof workoutsTable.$inferInsert;
