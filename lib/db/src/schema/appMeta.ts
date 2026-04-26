import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const appMetaTable = pgTable("app_meta", {
  userId: text("user_id").notNull().default(""),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.key] }),
]);

export type AppMeta = typeof appMetaTable.$inferSelect;
