import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq, ne } from "drizzle-orm";
import { nanoid } from "@/lib/nanoid";
import { getAdminSession } from "@/lib/auth-server";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configs = await db.select().from(systemConfig).where(ne(systemConfig.key, "telegram_sync_cursors"));
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key, value, description } = await req.json();

  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (key === "telegram_sync_cursors") {
    return NextResponse.json({ error: "ไม่สามารถแก้ไขสถานะภายในของตัวซิงก์ได้" }, { status: 400 });
  }

  // Upsert
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(systemConfig)
      .set({ value, description, updatedAt: new Date() })
      .where(eq(systemConfig.id, existing.id));
    return NextResponse.json({ id: existing.id });
  }

  const id = nanoid();
  await db.insert(systemConfig).values({ id, key, value, description });
  return NextResponse.json({ id });
}
