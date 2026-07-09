import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { syncTenantDomain, isCoolifyConfigured } from "@/lib/coolify";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCoolifyConfigured()) {
    return NextResponse.json(
      {
        error:
          "Coolify integration ยังไม่ได้ตั้งค่า — ต้องเพิ่ม COOLIFY_API_URL, COOLIFY_API_TOKEN, COOLIFY_TENANT_APP_UUID ใน env",
      },
      { status: 501 }
    );
  }

  const { id } = await params;
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const result = await syncTenantDomain(tenant.primaryDomain);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
