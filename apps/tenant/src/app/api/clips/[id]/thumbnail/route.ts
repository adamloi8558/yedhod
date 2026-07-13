import { NextRequest, NextResponse } from "next/server";
import { fetchObject } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope } from "@/lib/tenant-queries";

// Proxy the thumbnail through the tenant's own domain so <img src> stays
// on the tenant hostname. Thumbnails are small and public per tenant,
// so we can cache them aggressively via HTTP cache.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip?.thumbnailR2Key)
    return new NextResponse(null, { status: 404 });

  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;
  const ifModifiedSince = req.headers.get("if-modified-since") ?? undefined;

  const upstream = await fetchObject(clip.thumbnailR2Key, {
    ifNoneMatch,
    ifModifiedSince,
  });

  const passHeaders = [
    "content-type",
    "content-length",
    "etag",
    "last-modified",
  ];
  const headers = new Headers();
  for (const h of passHeaders) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Thumbnails are content-addressed at the R2 key — safe to cache for a
  // day on the client. `public` because thumbnails are shown pre-auth.
  headers.set("cache-control", "public, max-age=86400, immutable");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
