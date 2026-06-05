import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTicketMessages, supportTickets } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getSession } from "@/lib/auth-server";

// Returns a 302 to a short-lived presigned URL of a ticket attachment.
// Only the ticket owner or an admin may view.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;
  const [row] = await db
    .select({
      imageR2Key: supportTicketMessages.imageR2Key,
      ticketId: supportTicketMessages.ticketId,
    })
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.id, id))
    .limit(1);
  if (!row?.imageR2Key) {
    return NextResponse.json({ error: "ไม่พบรูป" }, { status: 404 });
  }
  const [ticket] = await db
    .select({ userId: supportTickets.userId })
    .from(supportTickets)
    .where(eq(supportTickets.id, row.ticketId))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "ไม่พบ ticket" }, { status: 404 });
  }
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "admin";
  if (!isAdmin && ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const url = await getPresignedDownloadUrl(row.imageR2Key, 60);
  return NextResponse.redirect(url, 302);
}
