import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages } from "@kodhom/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { sendSupportNotification, escapeHtml } from "@/lib/telegram-notify";

const createSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(5).max(4000),
  category: z
    .enum(["payment", "vip", "playback", "account", "other"])
    .default("other"),
  paymentId: z.string().optional(),
});

// GET: list current user's tickets (newest first).
// POST: open a new ticket with the first message.
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const tickets = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(50);
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // Soft-cap: don't let one user spam tickets. 5 open tickets per user
  // is plenty for any honest customer.
  const existingOpen = await db
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, session.user.id),
        eq(supportTickets.status, "open")
      )
    );
  if (existingOpen.length >= 5) {
    return NextResponse.json(
      { error: "คุณมีคำถามค้างอยู่หลายรายการแล้ว กรุณารอแอดมินตอบก่อน" },
      { status: 429 }
    );
  }

  const ticketId = nanoid();
  const messageId = nanoid();
  await db.transaction(async (tx) => {
    await tx.insert(supportTickets).values({
      id: ticketId,
      userId: session.user.id,
      paymentId: parsed.paymentId ?? null,
      subject: parsed.subject,
      category: parsed.category,
      status: "open",
      adminHasUnread: true,
    });
    await tx.insert(supportTicketMessages).values({
      id: messageId,
      ticketId,
      authorId: session.user.id,
      fromAdmin: false,
      body: parsed.body,
    });
  });

  // Fire-and-forget Telegram notification — never fail the request because
  // notifications didn't reach Telegram.
  const userLabel =
    session.user.name || session.user.email || session.user.id;
  const text =
    `🆕 <b>Support ticket ใหม่</b>\n` +
    `จาก: ${escapeHtml(userLabel)}\n` +
    `หมวด: ${parsed.category}\n` +
    `เรื่อง: ${escapeHtml(parsed.subject)}\n\n` +
    `${escapeHtml(parsed.body.slice(0, 600))}` +
    `\n\n👉 https://backoffice.xn--l3ca4bxbygoa7a.com/dashboard/support/${ticketId}`;
  void sendSupportNotification(text);

  return NextResponse.json({ ticketId });
}
