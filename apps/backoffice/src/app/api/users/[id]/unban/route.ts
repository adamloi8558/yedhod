import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await auth.api.unbanUser({
      headers: await headers(),
      body: { userId: id },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.unban",
      targetType: "user",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ยกเลิกแบนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
