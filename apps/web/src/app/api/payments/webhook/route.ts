import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, subscriptions, pricingPlans } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { nanoid } from "@/lib/nanoid";

function verifySignature(ref: string, signature: string): boolean {
  const apiKey = process.env.ANYPAY_API_KEY!;
  const expected = createHash("sha256")
    .update(`${ref}:${apiKey}`)
    .digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("[webhook] Received:", JSON.stringify(body));

  const { ref, status, signature, paid_at } = body;

  if (!verifySignature(ref, signature)) {
    console.log("[webhook] Signature verification failed for ref:", ref);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Find payment by anypay ref
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.anypayRef, ref))
    .limit(1);

  if (!payment) {
    console.log("[webhook] Payment not found for ref:", ref);
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (status === "paid") {
    // Update payment
    await db
      .update(payments)
      .set({ status: "completed", paidAt: paid_at ? new Date(paid_at) : new Date() })
      .where(eq(payments.id, payment.id));

    // Get pricing plan for duration
    const [plan] = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, payment.pricingPlanId))
      .limit(1);

    if (plan) {
      const startDate = new Date();
      const endDate =
        plan.durationDays >= 36500
          ? null // lifetime
          : new Date(startDate.getTime() + plan.durationDays * 86400000);

      await db.insert(subscriptions).values({
        id: nanoid(),
        userId: payment.userId,
        pricingPlanId: payment.pricingPlanId,
        status: "active",
        startDate,
        endDate,
        amountPaid: payment.amount,
        paymentRef: ref,
      });

      console.log(`[webhook] Subscription created for user ${payment.userId}`);
    }
  } else if (status === "expired" || status === "failed") {
    await db
      .update(payments)
      .set({ status: status as "expired" | "failed" })
      .where(eq(payments.id, payment.id));
  }

  return NextResponse.json({ ok: true });
}
