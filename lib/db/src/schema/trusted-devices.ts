import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { operatorsTable } from "./operators";

export const trustedDevicesTable = pgTable("trusted_devices", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull().references(() => operatorsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  deviceName: text("device_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
