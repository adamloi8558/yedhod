import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, pricingPlans, subscriptions, adminAuditLogs } from "@kodhom/db/schema";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const transRef = typeof body.transRef === "string" ? body.transRef.trim() : "";
  const linkId = typeof body.existingSubscriptionId === "string" ? body.existingSubscriptionId : null;
  const [owner] = await db.select({ userId: payments.userId }).from(payments).where(eq(payments.id, id)).limit(1);
  if (!owner) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  try {
    return await db.transaction(async (tx) => {
      const locks = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${"payment:" + owner.userId}, 0)) as locked`);
      if (!locks[0]?.locked) return NextResponse.json({ error: "กำลังตรวจรายการนี้ กรุณารอสักครู่" }, { status: 409 });
      const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update").limit(1);
      if (payment.status === "completed") return NextResponse.json({ success: true, paymentId: id });
      if (payment.status !== "pending") return NextResponse.json({ error: "อนุมัติได้เฉพาะรายการรอตรวจสอบ" }, { status: 409 });
      if (payment.provider === "easyslip" && (!payment.slipImageR2Key || !/^[a-zA-Z0-9._:/-]{6,200}$/.test(transRef) || body.confirmed !== true)) {
        return NextResponse.json({ error: "ต้องมีสลิป และระบุเลขธุรกรรมหลังตรวจยืนยันเงินเข้าบัญชีแล้ว" }, { status: 400 });
      }
      const reference = payment.provider === "easyslip" ? transRef : (payment.anypayRef ?? `manual-${id}`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"slip:" + reference}, 0))`);
      const [used] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.easyslipTransRef, reference)).limit(1);
      const [granted] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.paymentRef, reference)).limit(1);
      if ((used && used.id !== id) || granted) return NextResponse.json({ error: "เลขธุรกรรมนี้ใช้กับรายการหรือสิทธิ์อื่นแล้ว" }, { status: 409 });
      const [plan] = await tx.select().from(pricingPlans).where(eq(pricingPlans.id, payment.pricingPlanId)).limit(1);
      if (!plan) return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
      const now = new Date();
      const [active] = await tx.select().from(subscriptions).where(and(eq(subscriptions.userId, payment.userId),
        eq(subscriptions.pricingPlanId, payment.pricingPlanId), eq(subscriptions.status, "active"),
        or(isNull(subscriptions.endDate), gt(subscriptions.endDate, now)))).limit(1);
      if (active && !linkId) {
        return NextResponse.json({ error: "ลูกค้ามีสิทธิ์แพ็กเกจนี้แล้ว ตรวจว่าเป็นสิทธิ์ที่แอดมินเคยให้สำหรับยอดนี้หรือไม่",
          existingSubscriptionId: active.paymentRef?.startsWith("admin-") ? active.id : null }, { status: 409 });
      }
      if (linkId) {
        // Reconcile an explicitly identified manual grant, including an expired one.
        // Never replace another bank transaction or extend this subscription again.
        const [linked] = await tx.select().from(subscriptions).where(eq(subscriptions.id, linkId)).for("update").limit(1);
        if (!linked || linked.userId !== payment.userId || linked.pricingPlanId !== payment.pricingPlanId ||
            !linked.paymentRef?.startsWith("admin-") || linked.createdAt < payment.createdAt) {
          return NextResponse.json({ error: "สิทธิ์เดิมไม่ตรงกับรายการ หรือผูกกับการชำระอื่นแล้ว" }, { status: 409 });
        }
        await tx.update(subscriptions).set({ paymentRef: reference, amountPaid: payment.amount, updatedAt: now }).where(eq(subscriptions.id, linkId));
      } else {
        await tx.insert(subscriptions).values({ id: nanoid(), userId: payment.userId, pricingPlanId: payment.pricingPlanId,
          status: "active", startDate: now, endDate: plan.durationDays >= 36500 ? null : new Date(now.getTime() + plan.durationDays * 86400000),
          amountPaid: payment.amount, paymentRef: reference });
      }
      await tx.update(payments).set({ status: "completed", paidAt: now,
        ...(payment.provider === "easyslip" ? { easyslipTransRef: reference } : {}) }).where(eq(payments.id, id));
      await tx.insert(adminAuditLogs).values({ id: nanoid(), adminId: session.user.id,
        action: linkId ? "payment.reconcile" : "payment.manual_approve", targetType: "payment", targetId: id,
        metadata: { transRef: reference, paymentAmount: payment.amount, existingSubscriptionId: linkId, previousStatus: payment.status } });
      return NextResponse.json({ success: true, paymentId: id });
    });
  } catch {
    return NextResponse.json({ error: "ยังยืนยันผลไม่ได้ กรุณารีเฟรชรายการก่อนลองอีกครั้ง" }, { status: 503 });
  }
}
