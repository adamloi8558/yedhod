import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantAds } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantAdUpdateSchema } from "@kodhom/validators";
import { deleteObject } from "@kodhom/r2";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId, adId } = await params;

  const body = await req.json();
  const parsed = tenantAdUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(tenantAds)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ad: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; adId: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId, adId } = await params;

  const [row] = await db
    .select({ imageR2Key: tenantAds.imageR2Key })
    .from(tenantAds)
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db
    .delete(tenantAds)
    .where(and(eq(tenantAds.id, adId), eq(tenantAds.tenantId, tenantId)));

  if (row.imageR2Key) {
    await deleteObject(row.imageR2Key).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
