import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appMetaTable = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AppMeta = typeof appMetaTable.$inferSelect;
