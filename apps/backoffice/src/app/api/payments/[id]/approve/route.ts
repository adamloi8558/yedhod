import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, pricingPlans, subscriptions, adminAuditLogs } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

// Manually approve a pending payment without re-verifying the slip. Use
// when EasySlip rejected a transfer the provider dashboard confirmed —
// admin has eyeballed the slip and the provider transaction id and is
// vouching for it.
//
// Effect: payment → completed, paidAt = now, subscription created.
// Idempotent on the payment status: a second click is rejected with 409.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await params;

  try {
    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, id))
        .limit(1);
      if (!payment) throw new Error("NOT_FOUND");
      if (payment.status === "completed") throw new Error("ALREADY_COMPLETED");

      const [plan] = await tx
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.id, payment.pricingPlanId))
        .limit(1);
      if (!plan) throw new Error("PLAN_NOT_FOUND");

      const now = new Date();
      const endDate =
        plan.durationDays >= 36500
          ? null
          : new Date(now.getTime() + plan.durationDays * 86_400_000);

      await tx
        .update(payments)
        .set({ status: "completed", paidAt: now })
        .where(eq(payments.id, id));

      await tx.insert(subscriptions).values({
        id: nanoid(),
        userId: payment.userId,
        pricingPlanId: payment.pricingPlanId,
        status: "active",
        startDate: now,
        endDate,
        amountPaid: payment.amount,
        paymentRef: payment.easyslipTransRef ?? payment.anypayRef ?? `manual-${id}`,
      });

      await tx.insert(adminAuditLogs).values({
        id: nanoid(),
        adminId: session.user.id,
        action: "payment.manual_approve",
        targetType: "payment",
        targetId: id,
        metadata: {
          paymentAmount: payment.amount,
          planId: payment.pricingPlanId,
          previousStatus: payment.status,
        },
      });

      return { paymentId: id };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const m = err instanceof Error ? err.message : "";
    if (m === "NOT_FOUND")
      return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
    if (m === "ALREADY_COMPLETED")
      return NextResponse.json(
        { error: "รายการนี้สำเร็จแล้ว" },
        { status: 409 }
      );
    if (m === "PLAN_NOT_FOUND")
      return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
    if (typeof err === "object" && err && "code" in err && err.code === "23505")
      return NextResponse.json(
        { error: "อ้างอิงนี้ถูกใช้แล้ว" },
        { status: 409 }
      );
    console.error("[payment approve]", err);
    return NextResponse.json({ error: "ระบบขัดข้อง" }, { status: 500 });
  }
}
