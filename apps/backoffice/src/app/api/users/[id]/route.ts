import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// PUT /api/users/[id] — update name / email (admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.email === "string" && body.email.trim()) updates.email = body.email.trim();
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  try {
    await auth.api.adminUpdateUser({
      headers: await headers(),
      body: { userId: id, data: updates },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.update",
      targetType: "user",
      targetId: id,
      metadata: updates,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "อัปเดตไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — hard-delete user (admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
  }
  try {
    await auth.api.removeUser({
      headers: await headers(),
      body: { userId: id },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.delete",
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ลบไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
