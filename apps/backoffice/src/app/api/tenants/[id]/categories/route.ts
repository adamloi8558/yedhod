import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenantCategories, categories } from "@kodhom/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantCategoriesSchema } from "@kodhom/validators";
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
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, id));
  return NextResponse.json({ items: rows });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: tenantId } = await params;

  const body = await req.json();
  const parsed = tenantCategoriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const requested = parsed.data.items;
  if (requested.length > 0) {
    const ids = requested.map((r) => r.categoryId);
    const rows = await db
      .select({ id: categories.id, accessLevel: categories.accessLevel })
      .from(categories)
      .where(inArray(categories.id, ids));
    const validSet = new Set(
      rows.filter((r) => r.accessLevel === "member").map((r) => r.id)
    );
    const invalid = ids.filter((x) => !validSet.has(x));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `หมวดหมู่บางรายการไม่พบหรือไม่ใช่ระดับ member: ${invalid.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(tenantCategories)
      .where(eq(tenantCategories.tenantId, tenantId));
    if (requested.length > 0) {
      await tx.insert(tenantCategories).values(
        requested.map((r) => ({
          id: nanoid(),
          tenantId,
          categoryId: r.categoryId,
          sortOrder: r.sortOrder,
        }))
      );
    }
  });

  return NextResponse.json({ ok: true });
}
