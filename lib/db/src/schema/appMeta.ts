import { pgTable, text, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const appMetaTable = pgTable("app_meta", {
  id: serial("id").primaryKey(),
  // NULL means a global/system-level record (seed flags, shared defaults).
  // A non-null string is the Clerk userId for per-user records.
  userId: text("user_id"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  // Enforce one record per (userId, key) pair for non-null userId values.
  // Global records (userId IS NULL) are deduplicated via sentinel guards in code.
  uniqueIndex("app_meta_user_key_idx").on(table.userId, table.key),
]);

export type AppMeta = typeof appMetaTable.$inferSelect;
