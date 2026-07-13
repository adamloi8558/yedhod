import { NextRequest, NextResponse } from "next/server";
import { fetchObject } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";

// Serve the current tenant's logo via a same-origin URL so <img src> on
// the header does not leak the R2 hostname.
export async function GET(req: NextRequest) {
  const tenant = await getCurrentTenant();
  if (!tenant.logoR2Key)
    return new NextResponse(null, { status: 404 });

  const upstream = await fetchObject(tenant.logoR2Key, {
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
