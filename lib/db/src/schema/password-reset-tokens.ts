import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { operatorsTable } from "./operators";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => operatorsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
