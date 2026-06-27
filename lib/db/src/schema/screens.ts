import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const screensTable = pgTable("screens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id"),
  clientId: integer("client_id"),
  code: text("code").notNull().unique(),
  location: text("location"),
  status: text("status").notNull().default("unknown"),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreenSchema = createInsertSchema(screensTable).omit({ id: true, createdAt: true, code: true, status: true, lastSeen: true });
export type InsertScreen = z.infer<typeof insertScreenSchema>;
export type Screen = typeof screensTable.$inferSelect;
