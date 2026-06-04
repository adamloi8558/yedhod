import { NextRequest } from "next/server";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";

// Cache window must stay STRICTLY shorter than the presigned URL TTL,
// otherwise browsers/CDNs serve a redirect whose signed URL R2 has
// already rejected (403). Previously we cached 3600s s-maxage with a
// 7200s presign — anything cached past 2h returned a stale URL and the
// image silently broke. We now presign for 24h and cap edge cache at 6h,
// with a small browser cache to absorb burst loads on a category page.
const PRESIGN_TTL_SEC = 24 * 3600;
const BROWSER_MAX_AGE = 600;          // 10 min
const EDGE_MAX_AGE = 6 * 3600;        // 6h — well under PRESIGN_TTL_SEC

export const revalidate = 1800;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) return new Response("bad request", { status: 400 });

  const [row] = await db
    .select({ key: clips.thumbnailR2Key, isActive: clips.isActive })
    .from(clips)
    .where(eq(clips.id, id))
    .limit(1);

  if (!row || !row.isActive || !row.key) {
    return new Response("not found", { status: 404 });
  }

  try {
    const url = await getPresignedDownloadUrl(row.key, PRESIGN_TTL_SEC);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control": `public, max-age=${BROWSER_MAX_AGE}, s-maxage=${EDGE_MAX_AGE}, stale-while-revalidate=300`,
      },
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
