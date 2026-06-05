import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { pricingPlans, payments } from "@kodhom/db/schema";
import { and, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import {
  getPaymentAccounts,
  getPaymentMode,
  pickWeightedAccount,
} from "@/lib/payment-config";

const bodySchema = z.object({
  pricingPlanId: z.string().min(1),
});

const PAYMENT_TTL_MINUTES = 30;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const mode = await getPaymentMode();
  if (mode !== "easyslip") {
    return NextResponse.json(
      { error: "ระบบยังไม่ได้เปิดใช้งานช่องทางตรวจสลิป" },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.id, parsed.pricingPlanId))
    .limit(1);

  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
  }

  const now = new Date();
  const userId = session.user.id;

  // ── BLOCK: user already has a slip awaiting review (any plan).
  // We block creation of any new payment record while an admin is still
  // looking at a submitted slip — otherwise the customer keeps stacking
  // duplicates and the admin queue becomes unworkable.
  const [awaitingReview] = await db
    .select({
      id: payments.id,
      planId: payments.pricingPlanId,
    })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.status, "pending"),
        eq(payments.provider, "easyslip"),
        isNotNull(payments.slipImageR2Key)
      )
    )
    .limit(1);
  if (awaitingReview) {
    return NextResponse.json(
      {
        error:
          "คุณมีสลิปรอตรวจสอบอยู่แล้ว กรุณารอแอดมินตรวจสอบก่อนทำรายการใหม่",
        code: "AWAITING_REVIEW",
        existingPaymentId: awaitingReview.id,
      },
      { status: 409 }
    );
  }

  // ── REUSE: a pending payment for this exact plan that hasn't expired and
  // has no slip yet (user just reopened the page).
  const [reusable] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.pricingPlanId, parsed.pricingPlanId),
        eq(payments.status, "pending"),
        eq(payments.provider, "easyslip"),
        isNull(payments.slipImageR2Key),
        gt(payments.expiresAt, now)
      )
    )
    .orderBy(sql`${payments.createdAt} desc`)
    .limit(1);

  if (reusable) {
    return NextResponse.json({
      paymentId: reusable.id,
      account: reusable.accountSnapshot,
      amount: reusable.amount,
      expiresAt: reusable.expiresAt?.toISOString() ?? null,
      reused: true,
    });
  }

  // ── EXPIRE STALE: anything else still marked "pending" for this user on
  // easyslip without a slip is no longer relevant — flip it to expired so
  // the admin queue stays clean. We exclude records that have a slip so a
  // half-finished submission isn't silently discarded.
  await db
    .update(payments)
    .set({ status: "expired" })
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.status, "pending"),
        eq(payments.provider, "easyslip"),
        isNull(payments.slipImageR2Key)
      )
    );

  // ── CREATE NEW
  const accounts = await getPaymentAccounts();
  let account;
  try {
    account = pickWeightedAccount(accounts);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ไม่สามารถเลือกบัญชีได้" },
      { status: 503 }
    );
  }

  const accountSnapshot = {
    id: account.id,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
  };

  const paymentId = nanoid();
  const expiresAt = new Date(Date.now() + PAYMENT_TTL_MINUTES * 60_000);

  await db.insert(payments).values({
    id: paymentId,
    userId,
    pricingPlanId: parsed.pricingPlanId,
    provider: "easyslip",
    amount: plan.priceThb,
    status: "pending",
    accountSnapshot,
    expiresAt,
  });

  return NextResponse.json({
    paymentId,
    account: accountSnapshot,
    amount: plan.priceThb,
    expiresAt: expiresAt.toISOString(),
  });
}

// Silence unused-import warning when narrowing the surface above.
void ne;
