import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const screenGroupsTable = pgTable("screen_groups", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3B82F6"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreenGroupSchema = createInsertSchema(screenGroupsTable).omit({ id: true, createdAt: true });
export type InsertScreenGroup = z.infer<typeof insertScreenGroupSchema>;
export type ScreenGroup = typeof screenGroupsTable.$inferSelect;
