import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTicketMessages } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getAdminSession } from "@/lib/auth-server";

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
    .select({ key: supportTicketMessages.imageR2Key })
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.id, id))
    .limit(1);
  if (!row?.key) {
    return NextResponse.json({ error: "ไม่มีรูป" }, { status: 404 });
  }
  const url = await getPresignedDownloadUrl(row.key, 60);
  return NextResponse.redirect(url, 302);
}
