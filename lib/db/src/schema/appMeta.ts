import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const appMetaTable = pgTable("app_meta", {
  // userId is part of the composite PK — PostgreSQL requires PK columns to be NOT NULL.
  // The empty string "" is used as a sentinel for global/system-level records (seed flags,
  // shared defaults) that belong to no particular user.  Per-user records store the Clerk
  // userId. This is intentionally notNull().default("") rather than nullable.
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
