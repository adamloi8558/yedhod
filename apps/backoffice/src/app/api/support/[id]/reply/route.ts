import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

const schema = z.object({ body: z.string().min(1).max(4000) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await params;
  let parsed;
  try {
    parsed = schema.parse(await req.json());
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

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketMessages).values({
      id: nanoid(),
      ticketId: id,
      authorId: session.user.id,
      fromAdmin: true,
      body: parsed.body,
    });
    await tx
      .update(supportTickets)
      .set({
        updatedAt: new Date(),
        adminHasUnread: false,
        status: ticket.status === "open" ? "in_progress" : ticket.status,
      })
      .where(eq(supportTickets.id, id));
  });

  return NextResponse.json({ ok: true });
}
