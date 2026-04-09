import {
  pgTable,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";

export const telegramPostedClips = pgTable(
  "telegram_posted_clips",
  {
    id: text("id").primaryKey(),
    clipId: text("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    telegramMessageId: integer("telegram_message_id"),
    targetGroupId: text("target_group_id").notNull(),
    status: text("status").notNull().default("posted"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("telegram_posted_unique").on(table.clipId, table.targetGroupId),
  ]
);
