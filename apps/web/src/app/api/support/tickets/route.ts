import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages } from "@kodhom/db/schema";
import { desc, eq, and } from "drizzle-orm";
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
const VALID_CATEGORIES = new Set([
  "payment",
  "vip",
  "playback",
  "account",
  "other",
]);

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

  // Accept multipart so the open-ticket form can attach an image (e.g.
  // a screenshot of the failing slip). Fall back to plain JSON for
  // image-less submissions.
  let subject = "";
  let bodyText = "";
  let category = "other";
  let paymentId: string | null = null;
  let imageBuffer: Buffer | null = null;
  let imageMime = "";

  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData();
    subject = (form.get("subject") ?? "").toString().trim();
    bodyText = (form.get("body") ?? "").toString().trim();
    const cat = (form.get("category") ?? "other").toString();
    category = VALID_CATEGORIES.has(cat) ? cat : "other";
    paymentId = ((form.get("paymentId") ?? "").toString().trim() || null);
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "รูปต้องไม่เกิน 4 MB" }, { status: 400 });
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
      const j = (await req.json()) as {
        subject?: string;
        body?: string;
        category?: string;
        paymentId?: string;
      };
      subject = (j.subject ?? "").trim();
      bodyText = (j.body ?? "").trim();
      category = VALID_CATEGORIES.has(j.category ?? "other")
        ? (j.category as string)
        : "other";
      paymentId = (j.paymentId ?? "").trim() || null;
    } catch {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
  }

  if (subject.length < 3 || subject.length > 200) {
    return NextResponse.json({ error: "หัวข้อต้องมีความยาว 3-200 ตัวอักษร" }, { status: 400 });
  }
  if (bodyText.length < 5 && !imageBuffer) {
    return NextResponse.json({ error: "กรุณาอธิบายปัญหาหรือแนบรูป" }, { status: 400 });
  }
  if (bodyText.length > 4000) {
    return NextResponse.json({ error: "รายละเอียดยาวเกินไป" }, { status: 400 });
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
  let imageKey: string | null = null;
  if (imageBuffer) {
    const ext = imageMime.split("/")[1] ?? "bin";
    imageKey = `support/${ticketId}/${messageId}.${ext}`;
    try {
      await uploadBuffer(imageKey, imageBuffer, imageMime, imageBuffer.length);
    } catch (e) {
      console.error("[support create] r2 upload failed", e);
      return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(supportTickets).values({
      id: ticketId,
      userId: session.user.id,
      paymentId,
      subject,
      category: category as "payment" | "vip" | "playback" | "account" | "other",
      status: "open",
      adminHasUnread: true,
    });
    await tx.insert(supportTicketMessages).values({
      id: messageId,
      ticketId,
      authorId: session.user.id,
      fromAdmin: false,
      body: bodyText,
      imageR2Key: imageKey,
    });
  });

  const userLabel = session.user.name || session.user.email || session.user.id;
  const text =
    `🆕 <b>Support ticket ใหม่</b>\n` +
    `จาก: ${escapeHtml(userLabel)}\n` +
    `หมวด: ${category}\n` +
    `เรื่อง: ${escapeHtml(subject)}\n\n` +
    `${escapeHtml(bodyText.slice(0, 600))}` +
    (imageKey ? `\n📎 แนบรูป` : "") +
    `\n\n👉 https://backoffice.xn--l3ca4bxbygoa7a.com/dashboard/support/${ticketId}`;
  void sendSupportNotification(text);

  return NextResponse.json({ ticketId });
}
