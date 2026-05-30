import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions, pricingPlans } from "@kodhom/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { logAdminAction } from "@/lib/audit";

// POST /api/users/[id]/subscription — grant the user a fresh active sub
// body: { pricingPlanId } or { durationDays, amountPaid? } for ad-hoc
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: userId } = await params;
  const body = await req.json().catch(() => ({}));

  let durationDays: number | null = null;
  let pricingPlanId: string | null = null;
  let amountPaid: string | null = null;

  if (body.pricingPlanId) {
    const [plan] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, body.pricingPlanId))
      .limit(1);
    if (!plan) return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
    pricingPlanId = plan.id;
    durationDays = plan.durationDays;
    amountPaid = plan.priceThb;
  } else if (typeof body.durationDays === "number" && body.durationDays > 0) {
    durationDays = body.durationDays;
    amountPaid = body.amountPaid ? String(body.amountPaid) : null;
  } else {
    return NextResponse.json(
      { error: "ต้องระบุ pricingPlanId หรือ durationDays" },
      { status: 400 }
    );
  }

  // For ad-hoc grants we still need a pricingPlanId (FK is notNull). Pick the
  // first active plan as a placeholder if admin didn't choose one.
  if (!pricingPlanId) {
    const [anyPlan] = await db
      .select({ id: pricingPlans.id })
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .limit(1);
    if (!anyPlan) {
      return NextResponse.json(
        { error: "ไม่มี pricing plan ในระบบ — ต้องสร้างก่อน" },
        { status: 400 }
      );
    }
    pricingPlanId = anyPlan.id;
  }

  if (durationDays === null) {
    return NextResponse.json({ error: "durationDays ไม่ถูกต้อง" }, { status: 400 });
  }
  const now = new Date();
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const id = nanoid();

  try {
    await db.insert(subscriptions).values({
      id,
      userId,
      pricingPlanId,
      status: "active",
      startDate: now,
      endDate,
      amountPaid,
      // tag manual grants so they're distinguishable from payment-driven ones
      paymentRef: `admin-grant-${id}`,
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "subscription.grant",
      targetType: "user",
      targetId: userId,
      metadata: { subscriptionId: id, durationDays, pricingPlanId, amountPaid },
    });
    return NextResponse.json({ ok: true, subscriptionId: id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ให้ VIP ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
