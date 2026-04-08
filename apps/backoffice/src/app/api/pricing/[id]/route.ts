import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { pricingPlans } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { pricingPlanSchema } from "@kodhom/validators";
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
  const parsed = pricingPlanSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .update(pricingPlans)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(pricingPlans.id, id));

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
  await db.delete(pricingPlans).where(eq(pricingPlans.id, id));
  return NextResponse.json({ ok: true });
}
