import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  name: text("name"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type Workout = typeof workoutsTable.$inferSelect;
export type InsertWorkout = typeof workoutsTable.$inferInsert;
