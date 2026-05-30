import { db, adminAuditLogs } from "@kodhom/db";
import { nanoid } from "@/lib/nanoid";

/**
 * Append one admin action to admin_audit_logs.
 * Fire-and-await so the record commits before the response — admin
 * mutations should never silently lose their trail.
 */
export async function logAdminAction(input: {
  adminId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(adminAuditLogs).values({
      id: nanoid(),
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Audit logging must never break the actual admin action.
    console.warn("[audit] failed to write log:", err);
  }
}
