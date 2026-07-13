import { NextRequest, NextResponse } from "next/server";
import { fetchObject } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope } from "@/lib/tenant-queries";

// Proxy the R2 object through the tenant's own domain so the video src the
// browser sees is https://<tenant-domain>/api/clips/<id>/stream — no leak
// of "yedhod.<hash>.r2.cloudflarestorage.com".
//
// Range requests are preserved so browsers can seek within the video.
// Bandwidth walks through the VPS — acceptable for current scale; if this
// becomes a bottleneck we can migrate to a neutral R2 custom domain later.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip)
    return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  const ifNoneMatch = req.headers.get("if-none-match") ?? undefined;
  const ifModifiedSince = req.headers.get("if-modified-since") ?? undefined;

  const upstream = await fetchObject(clip.r2Key, {
    range,
    ifNoneMatch,
    ifModifiedSince,
  });

  // Forward status (200 / 206 / 304 / 416) and hop-by-hop headers the
  // browser needs — everything else is stripped so we don't leak R2's
  // server / date / cf-ray etc.
  const passHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
    "cache-control",
  ];
  const headers = new Headers();
  for (const h of passHeaders) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  // Force a sane default cache — clip files are immutable at their key,
  // so long client cache is fine. The response is per-tenant but the R2
  // key is not, so we don't want a shared CDN to cross tenants.
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "private, max-age=3600");
  }
  headers.set("accept-ranges", headers.get("accept-ranges") ?? "bytes");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
