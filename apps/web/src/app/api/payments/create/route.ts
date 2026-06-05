import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { pricingPlans, payments } from "@kodhom/db/schema";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createPaymentSchema } from "@kodhom/validators";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pricingPlanId, bankNumber, bankCode } = parsed.data;

  // Fetch pricing plan
  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.id, pricingPlanId))
    .limit(1);

  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
  }

  const now = new Date();
  const userId = session.user.id;

  // Reuse: existing pending AnyPay payment for the same plan that still
  // has a valid QR (expiresAt > now). The QR string itself is what the
  // user scans, so as long as it's still good we hand it back instead of
  // burning another AnyPay create call.
  const [reusable] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.pricingPlanId, pricingPlanId),
        eq(payments.status, "pending"),
        eq(payments.provider, "anypay"),
        gt(payments.expiresAt, now)
      )
    )
    .orderBy(sql`${payments.createdAt} desc`)
    .limit(1);

  if (reusable) {
    return NextResponse.json({
      paymentId: reusable.id,
      ref: reusable.anypayRef,
      qrText: reusable.qrText,
      qrImage: reusable.qrImage,
      expiresAt: reusable.expiresAt?.toISOString() ?? null,
      amount: reusable.amount,
      reused: true,
    });
  }

  // Expire any older AnyPay pendings for this user — same cleanup
  // principle as easyslip, just simpler because there's no slip to
  // preserve.
  await db
    .update(payments)
    .set({ status: "expired" })
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.status, "pending"),
        eq(payments.provider, "anypay")
      )
    );

  // Create AnyPay payment
  const apiUrl = process.env.ANYPAY_API_URL!;
  const username = process.env.ANYPAY_USERNAME!;
  const apiKey = process.env.ANYPAY_API_KEY!;
  const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`;

  const anypayRes = await fetch(`${apiUrl}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: parseFloat(plan.priceThb),
      bankNumber,
      webhookUrl,
    }),
  });

  if (!anypayRes.ok) {
    return NextResponse.json(
      { error: "ไม่สามารถสร้างรายการชำระเงินได้" },
      { status: 500 }
    );
  }

  const anypayData = await anypayRes.json();
  const result = anypayData.result;

  // Save payment record
  const paymentId = nanoid();
  await db.insert(payments).values({
    id: paymentId,
    userId: session.user.id,
    pricingPlanId,
    anypayRef: result.ref,
    amount: plan.priceThb,
    status: "pending",
    qrText: result.qrText,
    qrImage: result.qrImage,
    expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
  });

  return NextResponse.json({
    paymentId,
    ref: result.ref,
    qrText: result.qrText,
    qrImage: result.qrImage,
    expiresAt: result.expiresAt,
    amount: plan.priceThb,
  });
}
