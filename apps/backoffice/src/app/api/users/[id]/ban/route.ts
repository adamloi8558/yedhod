import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@kodhom/auth";
import { getAdminSession } from "@/lib/auth-server";
import { logAdminAction } from "@/lib/audit";

// POST /api/users/[id]/ban — ban user with optional reason + expires
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "แบนบัญชีตัวเองไม่ได้" }, { status: 400 });
  }
  const { reason, banExpiresIn } = await req.json().catch(() => ({}));
  try {
    await auth.api.banUser({
      headers: await headers(),
      body: {
        userId: id,
        banReason: typeof reason === "string" ? reason : undefined,
        // Better Auth expects seconds-from-now
        banExpiresIn:
          typeof banExpiresIn === "number" && banExpiresIn > 0
            ? banExpiresIn
            : undefined,
      },
    });
    await logAdminAction({
      adminId: session.user.id,
      action: "user.ban",
      targetType: "user",
      targetId: id,
      metadata: { reason: reason ?? null, banExpiresIn: banExpiresIn ?? null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "แบนไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
