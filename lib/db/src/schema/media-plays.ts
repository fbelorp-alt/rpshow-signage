import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const mediaPlaysTable = pgTable("media_plays", {
  id: serial("id").primaryKey(),
  screenId: integer("screen_id"),
  screenCode: text("screen_code").notNull(),
  screenName: text("screen_name").notNull(),
  mediaId: integer("media_id"),
  mediaName: text("media_name").notNull(),
  mediaType: text("media_type").notNull(),
  playedAt: timestamp("played_at").notNull().defaultNow(),
  durationSeconds: integer("duration_seconds"),
});

export type MediaPlay = typeof mediaPlaysTable.$inferSelect;
