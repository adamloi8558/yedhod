import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { accessLevelEnum } from "./enums";
import { categories } from "./categories";
import { users } from "./auth";

export const clips = pgTable("clips", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  accessLevel: accessLevelEnum("access_level").notNull().default("member"),
  r2Key: text("r2_key").notNull(),
  thumbnailR2Key: text("thumbnail_r2_key"),
  duration: real("duration"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  uploadedBy: text("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
