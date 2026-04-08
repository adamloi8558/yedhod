import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { clipSchema } from "@kodhom/validators";
import { getAdminSession } from "@/lib/auth-server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = clipSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .update(clips)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clips.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.delete(clips).where(eq(clips.id, id));
  return NextResponse.json({ ok: true });
}
