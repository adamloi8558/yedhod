import { NextRequest, NextResponse } from "next/server";
import { db, subscriptions } from "@kodhom/db";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// PUT /api/subscriptions/[id] — extend (extendDays) or set endDate, or cancel.
// body: { extendDays?: number } | { endDate?: string ISO } | { status: "cancelled" | "active" | "expired" }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1);
  if (!sub) return NextResponse.json({ error: "ไม่พบ subscription" }, { status: 404 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  let action = "subscription.update";

  if (typeof body.extendDays === "number" && body.extendDays !== 0) {
    const baseDate = sub.endDate && sub.endDate > new Date() ? sub.endDate : new Date();
    const newEnd = new Date(
      baseDate.getTime() + body.extendDays * 24 * 60 * 60 * 1000
    );
    updates.endDate = newEnd;
    if (body.extendDays > 0 && sub.status !== "active") updates.status = "active";
    action = "subscription.extend";
  } else if (body.endDate) {
    const d = new Date(body.endDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "endDate ไม่ถูกต้อง" }, { status: 400 });
    }
    updates.endDate = d;
    action = "subscription.set_end_date";
  }

  if (
    body.status === "cancelled" ||
    body.status === "active" ||
    body.status === "expired"
  ) {
    updates.status = body.status;
    if (body.status === "cancelled") action = "subscription.cancel";
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "ไม่มีอะไรให้แก้" }, { status: 400 });
  }

  try {
    await db.update(subscriptions).set(updates).where(eq(subscriptions.id, id));
    await logAdminAction({
      adminId: session.user.id,
      action,
      targetType: "subscription",
      targetId: id,
      metadata: {
        userId: sub.userId,
        ...("extendDays" in body && { extendDays: body.extendDays }),
        ...("endDate" in body && { endDate: body.endDate }),
        ...("status" in body && { status: body.status }),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
