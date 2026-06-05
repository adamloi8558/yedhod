import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { payments } from "./payments";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "payment",
  "vip",
  "playback",
  "account",
  "other",
]);

// Customer support tickets. A ticket belongs to a logged-in user (we
// don't accept anonymous tickets — payment-related issues all require
// us to know who's asking). The optional payment_id link lets us route
// the user straight from the failed-slip page into a pre-tagged ticket.
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentId: text("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    category: ticketCategoryEnum("category").notNull().default("other"),
    subject: text("subject").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    // Lightweight "unread for admin" flag — flipped to true on every new
    // user message, cleared when an admin replies. Cheaper than counting
    // messages each render.
    adminHasUnread: boolean("admin_has_unread").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("support_tickets_user_idx").on(table.userId),
    statusIdx: index("support_tickets_status_idx").on(
      table.status,
      table.updatedAt
    ),
  })
);

// Each ticket has a back-and-forth conversation. authorId references the
// user — admins replying use their admin user id; we tell which side a
// message came from by the `fromAdmin` flag, not by joining roles.
export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromAdmin: boolean("from_admin").notNull().default(false),
    body: text("body").notNull(),
    // Optional image attachment stored in R2. Body can be empty when
    // the message is image-only.
    imageR2Key: text("image_r2_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ticketCreatedIdx: index("support_ticket_messages_ticket_created_idx").on(
      table.ticketId,
      table.createdAt
    ),
  })
);
