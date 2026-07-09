import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants, tenantAds } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantUpdateSchema } from "@kodhom/validators";
import { deleteObject } from "@kodhom/r2";

async function loadTenant(id: string) {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await loadTenant(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ tenant: row });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = tenantUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }
  const [row] = await db
    .update(tenants)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ tenant: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await loadTenant(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const keys: string[] = [];
  if (existing.logoR2Key) keys.push(existing.logoR2Key);
  if (existing.faviconR2Key) keys.push(existing.faviconR2Key);
  const ads = await db
    .select({ imageR2Key: tenantAds.imageR2Key })
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id));
  for (const a of ads) if (a.imageR2Key) keys.push(a.imageR2Key);

  await db.delete(tenants).where(eq(tenants.id, id));

  await Promise.allSettled(keys.map((k) => deleteObject(k)));

  return NextResponse.json({ ok: true });
}
