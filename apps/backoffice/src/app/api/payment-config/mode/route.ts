import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { paymentModeSchema } from "@kodhom/validators";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = paymentModeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  await upsertConfig("payment_mode", parsed.data);
  return NextResponse.json({ ok: true });
}

async function upsertConfig(key: string, value: unknown) {
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);
  if (existing) {
    await db
      .update(systemConfig)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemConfig.id, existing.id));
  } else {
    await db.insert(systemConfig).values({ id: nanoid(), key, value });
  }
}
