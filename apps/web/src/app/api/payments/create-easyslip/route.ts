import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { pricingPlans, payments } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
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
    userId: session.user.id,
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
