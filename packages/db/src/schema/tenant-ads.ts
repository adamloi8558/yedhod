import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { adSlotEnum, adTypeEnum } from "./enums";

export const tenantAds = pgTable(
  "tenant_ads",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slot: adSlotEnum("slot").notNull(),
    type: adTypeEnum("type").notNull(),

    embedCode: text("embed_code"),

    imageR2Key: text("image_r2_key"),
    linkUrl: text("link_url"),
    altText: text("alt_text"),

    networkZoneId: text("network_zone_id"),
    networkWidth: integer("network_width"),
    networkHeight: integer("network_height"),

    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    tenantSlotIdx: index("tenant_ads_tenant_slot_idx").on(t.tenantId, t.slot),
  })
);
