import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const operatorsTable = pgTable("operators", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("operator"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  segment: text("segment"),
  jobRole: text("job_role"),
  screenCount: text("screen_count"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  trialDays: integer("trial_days").notNull().default(30),
  monthlyAmount: text("monthly_amount").notNull().default("0.00"),
  pricePerScreen: text("price_per_screen").notNull().default("50.00"),
  blocked: boolean("blocked").notNull().default(false),
});

export type Operator = typeof operatorsTable.$inferSelect;
