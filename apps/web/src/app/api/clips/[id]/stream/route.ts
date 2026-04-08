import { NextRequest, NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { headers } from "next/headers";
import { getActiveSubscription, hasClipAccess, checkDeviceLimit } from "@/lib/access-control";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  const [clip] = await db
    .select()
    .from(clips)
    .where(and(eq(clips.id, id), eq(clips.isActive, true)))
    .limit(1);

  if (!clip) {
    return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });
  }

  const userRole = (session.user as Record<string, unknown>).role as string ?? "member";

  // Admin bypasses all checks
  if (userRole !== "admin") {
    // Check device limit
    const deviceCheck = await checkDeviceLimit(session.user.id);
    if (!deviceCheck.allowed) {
      return NextResponse.json(
        {
          error: `เกินจำนวนอุปกรณ์ที่อนุญาต (${deviceCheck.current}/${deviceCheck.max})`,
          code: "DEVICE_LIMIT",
        },
        { status: 403 }
      );
    }

    // Check subscription (with expiry)
    const sub = await getActiveSubscription(session.user.id, clip.categoryId);
    if (!sub) {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์เข้าถึงคลิปนี้" },
        { status: 403 }
      );
    }

    if (!hasClipAccess(userRole, clip.accessLevel, true)) {
      return NextResponse.json(
        { error: "คลิปนี้สำหรับสมาชิก VIP เท่านั้น" },
        { status: 403 }
      );
    }
  }

  const url = await getPresignedDownloadUrl(clip.r2Key, 7200);

  return NextResponse.json({ url });
}
