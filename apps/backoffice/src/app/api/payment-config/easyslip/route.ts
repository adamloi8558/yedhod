import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { easyslipConfigSchema } from "@kodhom/validators";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = easyslipConfigSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "easyslip_config"))
    .limit(1);
  if (existing) {
    await db
      .update(systemConfig)
      .set({ value: parsed.data, updatedAt: new Date() })
      .where(eq(systemConfig.id, existing.id));
  } else {
    await db.insert(systemConfig).values({
      id: nanoid(),
      key: "easyslip_config",
      value: parsed.data,
    });
  }
  return NextResponse.json({ ok: true });
}
