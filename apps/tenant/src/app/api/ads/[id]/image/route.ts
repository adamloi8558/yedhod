import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@kodhom/db";
import { tenantAds } from "@kodhom/db/schema";
import { fetchObject } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";

// Serve a banner ad's image via same-origin. Scoped to the current tenant
// so a domain can never proxy another tenant's assets.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const [ad] = await db
    .select({ imageR2Key: tenantAds.imageR2Key })
    .from(tenantAds)
    .where(
      and(
        eq(tenantAds.id, id),
        eq(tenantAds.tenantId, tenant.id),
        eq(tenantAds.isActive, true)
      )
    )
    .limit(1);
  if (!ad?.imageR2Key) return new NextResponse(null, { status: 404 });

  const upstream = await fetchObject(ad.imageR2Key, {
    ifNoneMatch: req.headers.get("if-none-match") ?? undefined,
    ifModifiedSince: req.headers.get("if-modified-since") ?? undefined,
  });

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "public, max-age=86400");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
