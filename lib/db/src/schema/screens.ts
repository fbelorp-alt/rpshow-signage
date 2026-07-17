import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playlistsTable } from "./playlists";
import { screenGroupsTable } from "./screen-groups";

export const screensTable = pgTable("screens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id"),
  clientId: integer("client_id"),
  code: text("code").notNull().unique(),
  location: text("location"),
  status: text("status").notNull().default("unknown"),
  lastSeen: timestamp("last_seen"),
  defaultPlaylistId: integer("default_playlist_id").references(() => playlistsTable.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  groupId: integer("group_id").references(() => screenGroupsTable.id, { onDelete: "set null" }),
  tags: text("tags"),
  lastScreenshot: text("last_screenshot"),
  powerOnTime: text("power_on_time"),
  powerOffTime: text("power_off_time"),
  panelWidth: integer("panel_width"),
  panelHeight: integer("panel_height"),
  panelRotation: integer("panel_rotation").notNull().default(0),
  targetBrightness: integer("target_brightness"),
  powerScheduleJson: text("power_schedule_json"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  blocked: boolean("blocked").notNull().default(false),
  price: text("price"),
  photoUrl: text("photo_url"),
  onlineSince: timestamp("online_since"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScreenSchema = createInsertSchema(screensTable).omit({ id: true, createdAt: true, code: true, status: true, lastSeen: true });
export type InsertScreen = z.infer<typeof insertScreenSchema>;
export type Screen = typeof screensTable.$inferSelect;

export const brightnessSchedulesTable = pgTable("brightness_schedules", {
  id: serial("id").primaryKey(),
  screenId: integer("screen_id").notNull().references(() => screensTable.id, { onDelete: "cascade" }),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  brightness: integer("brightness").notNull(),
  days: text("days").notNull().default("0,1,2,3,4,5,6"),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type BrightnessSchedule = typeof brightnessSchedulesTable.$inferSelect;
