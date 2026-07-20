import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const apkVersionsTable = pgTable("apk_versions", {
  id: serial("id").primaryKey(),
  profile: text("profile").notNull(),
  version: text("version").notNull(),
  versionCode: integer("version_code").notNull(),
  apkUrl: text("apk_url").notNull(),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ApkVersion = typeof apkVersionsTable.$inferSelect;
