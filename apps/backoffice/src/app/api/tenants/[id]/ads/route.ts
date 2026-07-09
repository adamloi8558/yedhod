import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantAds } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantAdCreateSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await db
    .select()
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));
  return NextResponse.json({ ads: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId } = await params;

  const body = await req.json();
  const parsed = tenantAdCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const base = {
    id: nanoid(),
    tenantId,
    slot: parsed.data.slot,
    type: parsed.data.type,
    sortOrder: parsed.data.sortOrder,
    isActive: parsed.data.isActive,
    embedCode: null as string | null,
    imageR2Key: null as string | null,
    linkUrl: null as string | null,
    altText: null as string | null,
    networkZoneId: null as string | null,
    networkWidth: null as number | null,
    networkHeight: null as number | null,
  };
  let record = base;
  switch (parsed.data.type) {
    case "embed":
      record = { ...base, embedCode: parsed.data.embedCode };
      break;
    case "banner":
      record = {
        ...base,
        imageR2Key: parsed.data.imageR2Key,
        linkUrl: parsed.data.linkUrl ?? null,
        altText: parsed.data.altText ?? null,
      };
      break;
    case "galaksion":
    case "aads":
      record = {
        ...base,
        networkZoneId: parsed.data.networkZoneId,
        networkWidth: parsed.data.networkWidth ?? null,
        networkHeight: parsed.data.networkHeight ?? null,
      };
      break;
  }

  const [row] = await db.insert(tenantAds).values(record).returning();
  return NextResponse.json({ ad: row });
}
