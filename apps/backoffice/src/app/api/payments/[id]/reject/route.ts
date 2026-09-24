import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, adminAuditLogs } from "@kodhom/db/schema";
import { eq, sql } from "drizzle-orm";
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
  if (req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });

  let reason: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reason === "string") reason = body.reason.slice(0, 500);
  } catch {
    // optional body
  }

  const [owner] = await db.select({ userId: payments.userId }).from(payments).where(eq(payments.id, id)).limit(1);
  if (!owner) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  return db.transaction(async (tx) => {
    const locks = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${"payment:" + owner.userId}, 0)) as locked`);
    if (!locks[0]?.locked) return NextResponse.json({ error: "กำลังตรวจรายการ กรุณารอสักครู่" }, { status: 409 });
    const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for("update").limit(1);
    if (payment.status !== "pending") return NextResponse.json({ error: "รายการนี้ดำเนินการแล้ว" }, { status: 409 });
    await tx.update(payments).set({ status: "failed" }).where(eq(payments.id, id));
    await tx.insert(adminAuditLogs).values({ id: nanoid(), adminId: session.user.id, action: "payment.reject",
      targetType: "payment", targetId: id, metadata: { reason, previousStatus: payment.status } });
    return NextResponse.json({ success: true });
  });
}
