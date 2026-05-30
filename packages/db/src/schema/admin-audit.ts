import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Audit trail for admin actions. Every mutating action by an admin
 * (ban, delete, grant VIP, reset password, revoke session, impersonate,
 * bulk ops, etc.) writes a row here.
 *
 * - adminId: who did it (FK users — set null if admin user deleted later)
 * - action: machine-readable verb (e.g. "user.ban", "subscription.grant")
 * - targetType / targetId: what was touched ("user"/<id>, "session"/<id>, ...)
 * - metadata: per-action structured payload (reason, duration, plan, etc.)
 */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    adminCreatedIdx: index("admin_audit_admin_created_idx").on(
      table.adminId,
      table.createdAt
    ),
    targetIdx: index("admin_audit_target_idx").on(
      table.targetType,
      table.targetId
    ),
    createdIdx: index("admin_audit_created_idx").on(table.createdAt),
  })
);
