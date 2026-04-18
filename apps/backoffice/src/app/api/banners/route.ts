import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { bannersListSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";
import { getAdminSession } from "@/lib/auth-server";

const BANNERS_KEY = "banners";

async function readBanners() {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, BANNERS_KEY))
    .limit(1);
  if (!row) return [];
  return Array.isArray(row.value) ? row.value : [];
}

async function writeBanners(banners: unknown[]) {
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, BANNERS_KEY))
    .limit(1);

  if (existing) {
    await db
      .update(systemConfig)
      .set({ value: banners, updatedAt: new Date() })
      .where(eq(systemConfig.id, existing.id));
    return;
  }

  await db.insert(systemConfig).values({
    id: nanoid(),
    key: BANNERS_KEY,
    value: banners,
    description: "Homepage banners (slider)",
  });
}

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const banners = await readBanners();
  return NextResponse.json(banners);
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = bannersListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await writeBanners(parsed.data);
  return NextResponse.json({ ok: true });
}
