import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// DELETE /api/users/[id]/sessions/[token] — revoke a specific session
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, token } = await params;
  try {
    await auth.api.revokeUserSession({
      headers: await headers(),
      body: { sessionToken: token },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.revoke_session",
      targetType: "user",
      targetId: id,
      metadata: { sessionToken: token.slice(0, 12) + "..." },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เตะ session ไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
