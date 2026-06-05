import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, adminAuditLogs } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

// Reject a pending payment — mark it failed so it leaves the queue.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await params;

  let reason: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reason === "string") reason = body.reason.slice(0, 500);
  } catch {
    // optional body
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  if (!payment)
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  if (payment.status === "completed")
    return NextResponse.json(
      { error: "รายการนี้สำเร็จแล้ว" },
      { status: 409 }
    );

  await db
    .update(payments)
    .set({ status: "failed" })
    .where(eq(payments.id, id));

  await db.insert(adminAuditLogs).values({
    id: nanoid(),
    adminId: session.user.id,
    action: "payment.reject",
    targetType: "payment",
    targetId: id,
    metadata: {
      reason,
      previousStatus: payment.status,
    },
  });

  return NextResponse.json({ success: true });
}
