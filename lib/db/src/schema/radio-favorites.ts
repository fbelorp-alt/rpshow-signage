import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

/** Stations saved by an operator. Station data is kept as a snapshot so it remains
 * useful even when Radio Browser changes or removes the station. */
export const radioFavoritesTable = pgTable("radio_favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  stationUuid: text("station_uuid").notNull(),
  stationJson: text("station_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userStationUnique: unique("radio_favorites_user_station_unique").on(table.userId, table.stationUuid),
}));

export type RadioFavorite = typeof radioFavoritesTable.$inferSelect;