import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  unique,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const pricingPlans = pgTable(
  "pricing_plans",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    durationDays: integer("duration_days").notNull(),
    priceThb: numeric("price_thb", { precision: 10, scale: 2 }).notNull(),
    maxDevices: integer("max_devices").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.categoryId, table.slug)]
);
