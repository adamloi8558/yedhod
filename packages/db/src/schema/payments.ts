import {
  pgTable,
  text,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { paymentStatusEnum } from "./enums";
import { users } from "./auth";
import { categories } from "./categories";
import { pricingPlans } from "./pricing";

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pricingPlanId: text("pricing_plan_id")
    .notNull()
    .references(() => pricingPlans.id),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  anypayRef: text("anypay_ref"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  qrText: text("qr_text"),
  qrImage: text("qr_image"),
  expiresAt: timestamp("expires_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
