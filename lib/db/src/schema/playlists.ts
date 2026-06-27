import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { mediaTable } from "./media";

export const playlistsTable = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: text("user_id"),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlistItemsTable = pgTable("playlist_items", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull().references(() => playlistsTable.id, { onDelete: "cascade" }),
  mediaId: integer("media_id").notNull().references(() => mediaTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(10),
});

export const insertPlaylistSchema = createInsertSchema(playlistsTable).omit({ id: true, createdAt: true });
export const insertPlaylistItemSchema = createInsertSchema(playlistItemsTable).omit({ id: true });
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;
export type Playlist = typeof playlistsTable.$inferSelect;
export type PlaylistItem = typeof playlistItemsTable.$inferSelect;
