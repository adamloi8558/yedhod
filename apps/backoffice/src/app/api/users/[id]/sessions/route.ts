import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// GET /api/users/[id]/sessions — list this user's active sessions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const res = await auth.api.listUserSessions({
      headers: await headers(),
      body: { userId: id },
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ดึง session ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]/sessions — revoke ALL sessions for this user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await auth.api.revokeUserSessions({
      headers: await headers(),
      body: { userId: id },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.revoke_all_sessions",
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เตะ session ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
