import {
  pgTable,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";
import { categories } from "./categories";

export const telegramSyncMessages = pgTable(
  "telegram_sync_messages",
  {
    id: text("id").primaryKey(),
    telegramMessageId: integer("telegram_message_id").notNull(),
    telegramTopicId: integer("telegram_topic_id").notNull(),
    telegramGroupId: text("telegram_group_id").notNull(),
    clipId: text("clip_id").references(() => clips.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => categories.id),
    mediaType: text("media_type"),
    status: text("status").notNull().default("synced"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("telegram_sync_unique").on(
      table.telegramGroupId,
      table.telegramTopicId,
      table.telegramMessageId
    ),
  ]
);
