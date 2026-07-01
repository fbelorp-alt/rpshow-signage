import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const subscriptionPaymentsTable = pgTable("subscription_payments", {
  id: serial("id").primaryKey(),
  operatorId: integer("operator_id").notNull(),
  referenceMonth: text("reference_month").notNull(),
  status: text("status").notNull().default("pending"),
  amount: text("amount").notNull().default("80.00"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SubscriptionPayment = typeof subscriptionPaymentsTable.$inferSelect;
