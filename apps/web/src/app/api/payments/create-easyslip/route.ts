import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { pricingPlans, payments } from "@kodhom/db/schema";
import { and, eq, desc, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { getPaymentAccounts, getPaymentMode, pickWeightedAccount } from "@/lib/payment-config";

const bodySchema = z.object({ pricingPlanId: z.string().min(1), newOrder: z.boolean().optional() });
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  if (await getPaymentMode() !== "easyslip") return NextResponse.json({ error: "ช่องทางตรวจสลิปยังไม่เปิดใช้งาน" }, { status: 400 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  return db.transaction(async (tx) => {
    const locks = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${"payment:" + session.user.id}, 0)) as locked`);
    if (!locks[0]?.locked) return NextResponse.json({ error: "กำลังตรวจรายการ กรุณารอสักครู่แล้วลองใหม่" }, { status: 429 });
    const [plan] = await tx.select().from(pricingPlans).where(eq(pricingPlans.id, parsed.data.pricingPlanId)).limit(1);
    if (!plan) return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
    const [existing] = await tx.select().from(payments).where(and(eq(payments.userId, session.user.id),
      eq(payments.pricingPlanId, plan.id), eq(payments.provider, "easyslip"), eq(payments.status, "pending")))
      .orderBy(desc(payments.createdAt)).limit(1);
    const expired = existing?.expiresAt && existing.expiresAt.getTime() < Date.now();
    // Resume review instead of returning an unrecoverable creation error.
    // Creating another plan must never discard earlier payments/evidence.
    if (existing && (existing.slipImageR2Key || !parsed.data.newOrder || !expired)) {
      return NextResponse.json({ paymentId: existing.id, account: existing.accountSnapshot, amount: existing.amount,
        expiresAt: existing.expiresAt, hasSlip: !!existing.slipImageR2Key, reused: true });
    }
    if (!plan.isActive) return NextResponse.json({ error: "แพ็กเกจนี้ปิดรับรายการใหม่แล้ว" }, { status: 400 });
    if (existing) await tx.update(payments).set({ status: "expired" }).where(and(eq(payments.id, existing.id), isNull(payments.slipImageR2Key)));
    const accounts = await getPaymentAccounts();
    let account;
    try { account = pickWeightedAccount(accounts); }
    catch { return NextResponse.json({ error: "บัญชีรับเงินยังไม่พร้อม กรุณาติดต่อแอดมิน" }, { status: 503 }); }
    const snapshot = { id: account.id, bankCode: account.bankCode, bankName: account.bankName, accountNumber: account.accountNumber, accountName: account.accountName };
    const id = nanoid();
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await tx.insert(payments).values({ id, userId: session.user.id, pricingPlanId: plan.id, provider: "easyslip",
      amount: plan.priceThb, accountSnapshot: snapshot, status: "pending", expiresAt });
    return NextResponse.json({ paymentId: id, account: snapshot, amount: plan.priceThb, expiresAt, hasSlip: false });
  });
}
