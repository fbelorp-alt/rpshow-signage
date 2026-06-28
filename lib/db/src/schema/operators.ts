import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const operatorsTable = pgTable("operators", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("operator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Operator = typeof operatorsTable.$inferSelect;
