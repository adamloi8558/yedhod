import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { categories } from "./categories";

export const tenantCategories = pgTable(
  "tenant_categories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniquePair: uniqueIndex("tenant_categories_unique").on(
      t.tenantId,
      t.categoryId
    ),
    tenantIdx: index("tenant_categories_tenant_idx").on(t.tenantId),
  })
);
