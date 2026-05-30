import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  db,
  users,
  subscriptions,
  pricingPlans,
  adminAuditLogs,
} from "@kodhom/db";
import { auth } from "@kodhom/auth";
import { eq, desc, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-server";
import { UserDetailClient } from "@/components/user-detail-client";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) notFound();

  // Subs with plan name
  const subRows = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      amountPaid: subscriptions.amountPaid,
      planName: pricingPlans.name,
    })
    .from(subscriptions)
    .leftJoin(pricingPlans, eq(subscriptions.pricingPlanId, pricingPlans.id))
    .where(eq(subscriptions.userId, id))
    .orderBy(desc(subscriptions.createdAt));

  // Sessions via Better Auth (returns expected shape)
  let sessions: {
    id: string;
    token: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: string;
    createdAt: string;
  }[] = [];
  try {
    const sres = await auth.api.listUserSessions({
      headers: await headers(),
      body: { userId: id },
    });
    // Better Auth returns { sessions: [...] }
    const list = (sres as { sessions?: unknown[] }).sessions ?? [];
    sessions = list.map((s) => {
      const row = s as {
        id: string;
        token: string;
        userAgent?: string | null;
        ipAddress?: string | null;
        expiresAt: string | Date;
        createdAt: string | Date;
      };
      return {
        id: row.id,
        token: row.token,
        userAgent: row.userAgent ?? null,
        ipAddress: row.ipAddress ?? null,
        expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : row.expiresAt.toISOString(),
        createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
      };
    });
  } catch {
    // ignore — show empty
  }

  // Active plans for "ให้ VIP" dropdown
  const plans = await db
    .select({
      id: pricingPlans.id,
      name: pricingPlans.name,
      durationDays: pricingPlans.durationDays,
      priceThb: pricingPlans.priceThb,
    })
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, true))
    .orderBy(pricingPlans.sortOrder);

  // Recent audit entries targeting this user
  const auditRows = await db
    .select({
      id: adminAuditLogs.id,
      action: adminAuditLogs.action,
      metadata: adminAuditLogs.metadata,
      createdAt: adminAuditLogs.createdAt,
    })
    .from(adminAuditLogs)
    .where(
      and(
        eq(adminAuditLogs.targetType, "user"),
        eq(adminAuditLogs.targetId, id)
      )
    )
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(20);

  return (
    <UserDetailClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as "member" | "vip" | "admin",
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires ? user.banExpires.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
      }}
      subs={subRows.map((s) => ({
        id: s.id,
        status: s.status as "active" | "expired" | "cancelled",
        startDate: s.startDate.toISOString(),
        endDate: s.endDate ? s.endDate.toISOString() : null,
        amountPaid: s.amountPaid,
        planName: s.planName,
      }))}
      sessions={sessions}
      plans={plans}
      audit={auditRows.map((a) => ({
        id: a.id,
        action: a.action,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      }))}
      currentAdminId={admin.user.id}
    />
  );
}
