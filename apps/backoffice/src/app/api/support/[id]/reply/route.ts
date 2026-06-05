import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets, supportTicketMessages } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";
import { uploadBuffer } from "@kodhom/r2";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }
  const { id } = await params;

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
        return NextResponse.json({ error: "รูปต้องไม่เกิน 4 MB" }, { status: 400 });
      }
      if (!ALLOWED_MIMES.has(file.type)) {
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
      const j = (await req.json()) as { body?: string };
      body = (j.body ?? "").trim();
    } catch {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
  }
  if (!body && !imageBuffer) {
    return NextResponse.json({ error: "พิมพ์ข้อความหรือแนบรูป" }, { status: 400 });
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

  const messageId = nanoid();
  let imageKey: string | null = null;
  if (imageBuffer) {
    const ext = imageMime.split("/")[1] ?? "bin";
    imageKey = `support/${id}/${messageId}.${ext}`;
    try {
      await uploadBuffer(imageKey, imageBuffer, imageMime, imageBuffer.length);
    } catch {
      return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ" }, { status: 502 });
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(supportTicketMessages).values({
      id: messageId,
      ticketId: id,
      authorId: session.user.id,
      fromAdmin: true,
      body,
      imageR2Key: imageKey,
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
