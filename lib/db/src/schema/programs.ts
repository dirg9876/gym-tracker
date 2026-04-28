import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { exercisesTable } from "./exercises";

export const customProgramsTable = pgTable("custom_programs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("custom_programs_user_idx").on(t.userId),
]);

export type CustomProgram = typeof customProgramsTable.$inferSelect;
export type InsertCustomProgram = typeof customProgramsTable.$inferInsert;

export const customProgramExercisesTable = pgTable("custom_program_exercises", {
  id: serial("id").primaryKey(),
  programId: integer("program_id")
    .notNull()
    .references(() => customProgramsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercisesTable.id),
  sortOrder: integer("sort_order").notNull().default(0),
  sets: integer("sets").notNull().default(3),
  repsMin: integer("reps_min").notNull().default(8),
  repsMax: integer("reps_max").notNull().default(12),
  intent: text("intent").notNull().default("hypertrophy"),
  note: text("note"),
});

export type CustomProgramExercise = typeof customProgramExercisesTable.$inferSelect;
export type InsertCustomProgramExercise = typeof customProgramExercisesTable.$inferInsert;
