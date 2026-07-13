import { NextRequest, NextResponse } from "next/server";
import { fetchObject } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";

// Serve the current tenant's favicon via same-origin so Search Console
// and any crawler doesn't see the R2 hostname on the icon link.
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant.faviconR2Key)
    return new NextResponse(null, { status: 404 });

  const upstream = await fetchObject(tenant.faviconR2Key, {
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
