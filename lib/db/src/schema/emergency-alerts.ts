import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const emergencyAlertsTable = pgTable("emergency_alerts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  message: text("message").notNull(),
  bgColor: text("bg_color").notNull().default("#DC2626"),
  textColor: text("text_color").notNull().default("#FFFFFF"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmergencyAlertSchema = createInsertSchema(emergencyAlertsTable).omit({ id: true, createdAt: true });
export type InsertEmergencyAlert = z.infer<typeof insertEmergencyAlertSchema>;
export type EmergencyAlert = typeof emergencyAlertsTable.$inferSelect;
