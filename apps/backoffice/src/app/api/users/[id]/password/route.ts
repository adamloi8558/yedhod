import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// POST /api/users/[id]/password — set a new password as admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { newPassword } = await req.json();
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" },
      { status: 400 }
    );
  }
  try {
    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId: id, newPassword },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.reset_password",
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "เปลี่ยนรหัสไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
