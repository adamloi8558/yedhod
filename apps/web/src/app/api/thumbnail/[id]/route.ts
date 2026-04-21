import { NextRequest } from "next/server";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";

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
    const url = await getPresignedDownloadUrl(row.key, 7200);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Cache-Control":
          "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
