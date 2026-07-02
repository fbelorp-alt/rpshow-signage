import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  name: text("name"),
  location: text("location"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  screenCode: text("screen_code"),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export type Device = typeof devicesTable.$inferSelect;
