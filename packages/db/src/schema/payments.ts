import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { paymentStatusEnum } from "./enums";
import { users } from "./auth";
import { categories } from "./categories";
import { pricingPlans } from "./pricing";

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pricingPlanId: text("pricing_plan_id")
      .notNull()
      .references(() => pricingPlans.id),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("anypay"),
    anypayRef: text("anypay_ref"),
    easyslipTransRef: text("easyslip_trans_ref"),
    accountSnapshot: jsonb("account_snapshot"),
    slipImageR2Key: text("slip_image_r2_key"),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    qrText: text("qr_text"),
    qrImage: text("qr_image"),
    expiresAt: timestamp("expires_at"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    anypayRefUniq: uniqueIndex("payments_anypay_ref_uniq")
      .on(table.anypayRef)
      .where(sql`${table.anypayRef} is not null`),
    easyslipTransRefUniq: uniqueIndex("payments_easyslip_trans_ref_uniq")
      .on(table.easyslipTransRef)
      .where(sql`${table.easyslipTransRef} is not null`),
  })
);
