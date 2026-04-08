import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";

export const withdrawalStatusEnum = pgEnum("withdrawal_status", [
  "pending",
  "completed",
  "rejected",
  "failed",
]);

export const withdrawals = pgTable("withdrawals", {
  id: text("id").primaryKey(),
  anypayRef: text("anypay_ref"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  bankNumber: text("bank_number").notNull(),
  bankCode: text("bank_code").notNull(),
  status: withdrawalStatusEnum("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
