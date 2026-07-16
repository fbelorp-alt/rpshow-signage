import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { screensTable } from "./screens";
import { playlistsTable } from "./playlists";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name"),
  clientName: text("client_name"),
  campaignGroupId: text("campaign_group_id"),
  screenId: integer("screen_id").notNull().references(() => screensTable.id, { onDelete: "cascade" }),
  playlistId: integer("playlist_id").notNull().references(() => playlistsTable.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  daysOfWeek: text("days_of_week"),
  active: boolean("active").notNull().default(true),
  endNotifiedAt: timestamp("end_notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
