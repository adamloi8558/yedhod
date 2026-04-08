import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { withdrawals } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount, bankNumber, bankCode } = await req.json();

  if (!amount || !bankNumber || !bankCode) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const apiUrl = process.env.ANYPAY_API_URL!;
  const username = process.env.ANYPAY_USERNAME!;
  const apiKey = process.env.ANYPAY_API_KEY!;
  const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`;
  const webhookUrl = `${process.env.NEXT_PUBLIC_BACKOFFICE_URL}/api/withdraw/webhook`;

  const id = nanoid();

  // Save withdraw request to DB
  await db.insert(withdrawals).values({
    id,
    amount: parseFloat(amount).toFixed(2),
    bankNumber,
    bankCode,
    status: "pending",
    requestedBy: session.user.id,
  });

  const res = await fetch(`${apiUrl}/withdraw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: parseFloat(amount),
      bankNumber,
      bankCode,
      webhookUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    await db.update(withdrawals).set({ status: "failed" }).where(eq(withdrawals.id, id));
    return NextResponse.json(
      { error: "Withdraw failed", details: err },
      { status: 500 }
    );
  }

  const data = await res.json();

  // Update with AnyPay reference
  if (data.ref) {
    await db.update(withdrawals).set({ anypayRef: data.ref }).where(eq(withdrawals.id, id));
  }

  return NextResponse.json({ ...data, withdrawId: id });
}
