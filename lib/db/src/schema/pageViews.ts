import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const pageViewsTable = pgTable("page_views", {
  id: serial("id").primaryKey(),
  page: text("page").notNull(),
  date: text("date").notNull(),
  hour: integer("hour").notNull(),
  count: integer("count").notNull().default(1),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("page_views_page_date_hour_idx").on(table.page, table.date, table.hour),
]);

export type PageView = typeof pageViewsTable.$inferSelect;
