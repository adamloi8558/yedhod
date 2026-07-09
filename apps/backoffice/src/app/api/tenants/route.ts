import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { tenantCreateSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  return NextResponse.json({ tenants: rows });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = tenantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 }
    );
  }

  const id = nanoid();
  const [row] = await db
    .insert(tenants)
    .values({ id, ...parsed.data })
    .returning();
  return NextResponse.json({ tenant: row });
}
