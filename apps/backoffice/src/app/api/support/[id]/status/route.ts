import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { supportTickets } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth-server";

const schema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

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

  await db
    .update(supportTickets)
    .set({ status: parsed.status, updatedAt: new Date() })
    .where(eq(supportTickets.id, id));

  return NextResponse.json({ ok: true });
}
