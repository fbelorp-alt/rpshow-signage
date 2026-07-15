import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { screensTable } from "./screens";

export const screenConnectionsTable = pgTable("screen_connections", {
  id: serial("id").primaryKey(),
  screenId: integer("screen_id").notNull().references(() => screensTable.id, { onDelete: "cascade" }),
  connectedAt: timestamp("connected_at").notNull(),
  disconnectedAt: timestamp("disconnected_at"),
});
