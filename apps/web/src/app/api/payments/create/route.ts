import { NextRequest, NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { db } from "@kodhom/db";
import { pricingPlans, payments } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { createPaymentSchema } from "@kodhom/validators";
import { headers } from "next/headers";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
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

  const { pricingPlanId, categoryId, bankNumber, bankCode } = parsed.data;

  // Fetch pricing plan
  const [plan] = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.id, pricingPlanId))
    .limit(1);

  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "ไม่พบแพ็กเกจ" }, { status: 404 });
  }

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
      bankCode,
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

  // Save payment record
  const paymentId = nanoid();
  await db.insert(payments).values({
    id: paymentId,
    userId: session.user.id,
    pricingPlanId,
    categoryId,
    anypayRef: anypayData.ref,
    amount: plan.priceThb,
    status: "pending",
    qrText: anypayData.qrText,
    qrImage: anypayData.qrImage,
    expiresAt: anypayData.expiresAt ? new Date(anypayData.expiresAt) : null,
  });

  return NextResponse.json({
    paymentId,
    ref: anypayData.ref,
    qrText: anypayData.qrText,
    qrImage: anypayData.qrImage,
    expiresAt: anypayData.expiresAt,
    amount: plan.priceThb,
  });
}
