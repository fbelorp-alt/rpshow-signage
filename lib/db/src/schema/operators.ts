import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const operatorsTable = pgTable("operators", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("operator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  segment: text("segment"),
  jobRole: text("job_role"),
  screenCount: text("screen_count"),
});

export type Operator = typeof operatorsTable.$inferSelect;
