import {
  pgTable,
  text,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { subscriptionStatusEnum } from "./enums";
import { users } from "./auth";
import { categories } from "./categories";
import { pricingPlans } from "./pricing";

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  pricingPlanId: text("pricing_plan_id")
    .notNull()
    .references(() => pricingPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date"),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }),
  paymentRef: text("payment_ref"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
