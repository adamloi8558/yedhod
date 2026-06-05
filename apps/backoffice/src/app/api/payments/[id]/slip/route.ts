import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { payments } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getAdminSession } from "@/lib/auth-server";

// Return a short-lived presigned URL to the uploaded slip so admins can
// open it in a new tab without us having to proxy the bytes.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await params;
  const [row] = await db
    .select({ key: payments.slipImageR2Key })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  if (!row?.key) {
    return NextResponse.json({ error: "ไม่มีสลิป" }, { status: 404 });
  }
  const url = await getPresignedDownloadUrl(row.key, 600);
  return NextResponse.redirect(url, 302);
}
