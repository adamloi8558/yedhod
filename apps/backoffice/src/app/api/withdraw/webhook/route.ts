import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@kodhom/db";
import { withdrawals } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";

function verifySignature(id: string, signature: string): boolean {
  const apiKey = process.env.ANYPAY_API_KEY!;
  const expected = createHash("sha256")
    .update(`${id}:${apiKey}`)
    .digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, status, signature } = body;

  if (!verifySignature(id, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Update withdrawal status in DB by anypayRef
  const mappedStatus =
    status === "completed" ? "completed" : status === "rejected" ? "rejected" : "failed";

  await db
    .update(withdrawals)
    .set({
      status: mappedStatus,
      completedAt: status === "completed" ? new Date() : null,
    })
    .where(eq(withdrawals.anypayRef, id));

  return NextResponse.json({ ok: true });
}
