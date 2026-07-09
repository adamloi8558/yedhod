import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    primaryDomain: text("primary_domain").notNull().unique(),

    logoR2Key: text("logo_r2_key"),
    faviconR2Key: text("favicon_r2_key"),
    tagline: text("tagline"),
    footerText: text("footer_text"),
    primaryColor: text("primary_color").notNull().default("#3b82f6"),
    accentColor: text("accent_color").notNull().default("#60a5fa"),
    backgroundColor: text("background_color").notNull().default("#0b0d13"),
    fgColor: text("fg_color").notNull().default("#e6e9f2"),

    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    domainIdx: index("tenants_domain_idx").on(t.primaryDomain),
    slugIdx: index("tenants_slug_idx").on(t.slug),
  })
);
