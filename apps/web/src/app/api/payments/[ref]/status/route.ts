import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments, adminAuditLogs } from "@kodhom/db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(or(eq(payments.anypayRef, ref), eq(payments.id, ref)), eq(payments.userId, session.user.id))
    )
    .limit(1);

  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [attempt] = payment.provider === "easyslip" ? await db.select({ metadata: adminAuditLogs.metadata })
    .from(adminAuditLogs).where(and(eq(adminAuditLogs.targetType, "payment"), eq(adminAuditLogs.targetId, payment.id), eq(adminAuditLogs.action, "payment.verify")))
    .orderBy(desc(adminAuditLogs.createdAt)).limit(1) : [];
  const code = (attempt?.metadata as { code?: string } | null)?.code;
  return NextResponse.json({ status: payment.status, hasSlip: !!payment.slipImageR2Key, code }, { headers: { "Cache-Control": "no-store" } });
}
