import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { screensTable } from "./screens";

export const screenSpeedLogsTable = pgTable("screen_speed_logs", {
  id: serial("id").primaryKey(),
  screenId: integer("screen_id").notNull().references(() => screensTable.id, { onDelete: "cascade" }),
  speedMbps: real("speed_mbps").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});
