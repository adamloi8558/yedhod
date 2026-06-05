import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages, users } from "@kodhom/db/schema";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { sendSupportNotification, escapeHtml } from "@/lib/telegram-notify";
import { uploadBuffer } from "@kodhom/r2";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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
      imageR2Key: supportTicketMessages.imageR2Key,
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

// POST: append a reply. Supports multipart/form-data for image uploads
// (field "image") AND falls back to plain JSON when no image is attached.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  const { id } = await params;

  // Pick body / image based on content-type.
  let body = "";
  let imageBuffer: Buffer | null = null;
  let imageMime = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData();
    body = (form.get("body") ?? "").toString().trim();
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "รูปต้องไม่เกิน 4 MB" },
          { status: 400 }
        );
      }
      if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
        return NextResponse.json(
          { error: "รองรับเฉพาะรูป JPG / PNG / GIF / WEBP" },
          { status: 400 }
        );
      }
      imageBuffer = Buffer.from(await file.arrayBuffer());
      imageMime = file.type;
    }
  } else {
    try {
      const json = (await req.json()) as { body?: string };
      body = (json.body ?? "").trim();
    } catch {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
  }

  if (!body && !imageBuffer) {
    return NextResponse.json(
      { error: "กรุณาพิมพ์ข้อความหรือแนบรูป" },
      { status: 400 }
    );
  }
  if (body.length > 4000) {
    return NextResponse.json({ error: "ข้อความยาวเกินไป" }, { status: 400 });
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

  // Upload the image to R2 BEFORE the DB write so we don't store a key
  // that doesn't exist if R2 fails.
  let imageKey: string | null = null;
  if (imageBuffer) {
    const ext = imageMime.split("/")[1] ?? "bin";
    const messageId = nanoid();
    imageKey = `support/${id}/${messageId}.${ext}`;
    try {
      await uploadBuffer(imageKey, imageBuffer, imageMime, imageBuffer.length);
    } catch (e) {
      console.error("[support reply] r2 upload failed", e);
      return NextResponse.json(
        { error: "อัปโหลดรูปไม่สำเร็จ" },
        { status: 502 }
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketMessages).values({
      id: nanoid(),
      ticketId: id,
      authorId: session.user.id,
      fromAdmin: isAdmin,
      body,
      imageR2Key: imageKey,
    });
    await tx
      .update(supportTickets)
      .set({
        updatedAt: new Date(),
        adminHasUnread: !isAdmin,
        status: isAdmin && ticket.status === "open" ? "in_progress" : ticket.status,
      })
      .where(eq(supportTickets.id, id));
  });

  if (!isAdmin) {
    const userLabel = session.user.name || session.user.email || session.user.id;
    const text =
      `💬 <b>ตอบกลับ ticket</b>\n` +
      `จาก: ${escapeHtml(userLabel)}\n` +
      `เรื่อง: ${escapeHtml(ticket.subject)}\n\n` +
      `${escapeHtml(body.slice(0, 600))}` +
      (imageKey ? `\n📎 แนบรูป` : "") +
      `\n\n👉 https://backoffice.xn--l3ca4bxbygoa7a.com/dashboard/support/${id}`;
    void sendSupportNotification(text);
  }

  return NextResponse.json({ ok: true });
}
