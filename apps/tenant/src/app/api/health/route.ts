import { NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants);
  return NextResponse.json({ ok: true, tenants: count });
}
