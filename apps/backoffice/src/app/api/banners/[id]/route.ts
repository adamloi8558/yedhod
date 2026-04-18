import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { deleteObject } from "@kodhom/r2";
import { getAdminSession } from "@/lib/auth-server";

const BANNERS_KEY = "banners";

interface BannerRecord {
  id: string;
  imageR2Key: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, BANNERS_KEY))
    .limit(1);

  if (!row || !Array.isArray(row.value)) {
    return NextResponse.json({ ok: true });
  }

  const banners = row.value as BannerRecord[];
  const target = banners.find((b) => b.id === id);
  const remaining = banners.filter((b) => b.id !== id);

  await db
    .update(systemConfig)
    .set({ value: remaining, updatedAt: new Date() })
    .where(eq(systemConfig.id, row.id));

  if (target?.imageR2Key) {
    try {
      await deleteObject(target.imageR2Key);
    } catch {
      // R2 delete failures shouldn't block the API response
    }
  }

  return NextResponse.json({ ok: true });
}
