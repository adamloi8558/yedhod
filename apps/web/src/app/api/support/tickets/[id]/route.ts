import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages, users } from "@kodhom/db/schema";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { sendSupportNotification, escapeHtml } from "@/lib/telegram-notify";

const replySchema = z.object({
  body: z.string().min(1).max(4000),
});

// GET: read a ticket + its messages. The owning user OR an admin can read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "ไม่พบ ticket" }, { status: 404 });
  }
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "admin";
  if (!isAdmin && ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const messages = await db
    .select({
      id: supportTicketMessages.id,
      body: supportTicketMessages.body,
      fromAdmin: supportTicketMessages.fromAdmin,
      createdAt: supportTicketMessages.createdAt,
      authorName: users.name,
    })
    .from(supportTicketMessages)
    .leftJoin(users, eq(users.id, supportTicketMessages.authorId))
    .where(eq(supportTicketMessages.ticketId, id))
    .orderBy(asc(supportTicketMessages.createdAt));

  return NextResponse.json({ ticket, messages });
}

// POST: append a reply.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;
  let parsed;
  try {
    parsed = replySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "ไม่พบ ticket" }, { status: 404 });
  }
  if (ticket.status === "closed") {
    return NextResponse.json({ error: "ticket ถูกปิดแล้ว" }, { status: 409 });
  }
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "admin";
  if (!isAdmin && ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketMessages).values({
      id: nanoid(),
      ticketId: id,
      authorId: session.user.id,
      fromAdmin: isAdmin,
      body: parsed.body,
    });
    await tx
      .update(supportTickets)
      .set({
        updatedAt: new Date(),
        // If admin replies, clear the unread flag; if customer replies,
        // raise it.
        adminHasUnread: !isAdmin,
        // First admin reply moves status from "open" to "in_progress".
        status: isAdmin && ticket.status === "open" ? "in_progress" : ticket.status,
      })
      .where(eq(supportTickets.id, id));
  });

  // Telegram notify on customer replies (admin replies don't need to
  // bounce back through Telegram).
  if (!isAdmin) {
    const userLabel = session.user.name || session.user.email || session.user.id;
    const text =
      `💬 <b>ตอบกลับ ticket</b>\n` +
      `จาก: ${escapeHtml(userLabel)}\n` +
      `เรื่อง: ${escapeHtml(ticket.subject)}\n\n` +
      `${escapeHtml(parsed.body.slice(0, 600))}` +
      `\n\n👉 https://backoffice.xn--l3ca4bxbygoa7a.com/dashboard/support/${id}`;
    void sendSupportNotification(text);
  }

  // Quiet the unused-import warning when 'and' isn't used in this file.
  void and;

  return NextResponse.json({ ok: true });
}
