import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { db, subscriptions, pricingPlans } from "@kodhom/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { logAdminAction } from "@/lib/audit";

type Action =
  | "ban"
  | "unban"
  | "delete"
  | "revoke_sessions"
  | "grant_vip";

interface BulkBody {
  action: Action;
  ids: string[];
  params?: { reason?: string; pricingPlanId?: string; durationDays?: number };
}

/**
 * POST /api/users/bulk — apply one action to many users, best-effort.
 * Continues on per-id failure and returns a per-id results array.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as BulkBody | null;
  if (!body?.action || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "action + ids required" }, { status: 400 });
  }

  const hdrs = await headers();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  // pre-resolve plan for grant_vip
  let resolvedPlan: { id: string; durationDays: number; priceThb: string } | null = null;
  if (body.action === "grant_vip") {
    const planId = body.params?.pricingPlanId;
    if (planId) {
      const [p] = await db
        .select({
          id: pricingPlans.id,
          durationDays: pricingPlans.durationDays,
          priceThb: pricingPlans.priceThb,
        })
        .from(pricingPlans)
        .where(eq(pricingPlans.id, planId))
        .limit(1);
      if (p) resolvedPlan = p;
    }
    if (!resolvedPlan) {
      const [p] = await db
        .select({
          id: pricingPlans.id,
          durationDays: pricingPlans.durationDays,
          priceThb: pricingPlans.priceThb,
        })
        .from(pricingPlans)
        .where(eq(pricingPlans.isActive, true))
        .limit(1);
      if (p) resolvedPlan = p;
    }
  }

  for (const id of body.ids) {
    try {
      if ((body.action === "delete" || body.action === "ban") && id === session.user.id) {
        throw new Error("ทำกับบัญชีตัวเองไม่ได้");
      }
      switch (body.action) {
        case "ban":
          await auth.api.banUser({
            headers: hdrs,
            body: { userId: id, banReason: body.params?.reason },
          });
          break;
        case "unban":
          await auth.api.unbanUser({ headers: hdrs, body: { userId: id } });
          break;
        case "delete":
          await auth.api.removeUser({ headers: hdrs, body: { userId: id } });
          break;
        case "revoke_sessions":
          await auth.api.revokeUserSessions({ headers: hdrs, body: { userId: id } });
          break;
        case "grant_vip": {
          if (!resolvedPlan) throw new Error("ไม่มี pricing plan");
          const days = body.params?.durationDays ?? resolvedPlan.durationDays;
          const now = new Date();
          const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          const subId = nanoid();
          await db.insert(subscriptions).values({
            id: subId,
            userId: id,
            pricingPlanId: resolvedPlan.id,
            status: "active",
            startDate: now,
            endDate,
            amountPaid: resolvedPlan.priceThb,
            paymentRef: `admin-bulk-${subId}`,
          });
          break;
        }
        default:
          throw new Error(`unknown action: ${body.action}`);
      }
      results.push({ id, ok: true });
    } catch (err) {
      results.push({
        id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await logAdminAction({
    adminId: session.user.id,
    action: `user.bulk.${body.action}`,
    targetType: "user",
    targetId: null,
    metadata: {
      ids: body.ids,
      params: body.params,
      results: { success: results.filter((r) => r.ok).length, fail: results.filter((r) => !r.ok).length },
    },
  });

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;
  return NextResponse.json({ ok: true, total: results.length, success: successCount, fail: failCount, results });
}
