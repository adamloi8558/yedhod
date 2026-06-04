import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";

// Teaser endpoint — open to everyone (guest + non-VIP).
// Returns a short-lived presigned URL of the full clip file; the client
// is responsible for stopping playback at `teaserDuration` seconds.
// We accept that a determined user can grab the URL — teaser is a UX
// trust device, not DRM.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [clip] = await db
    .select({
      r2Key: clips.r2Key,
      duration: clips.duration,
    })
    .from(clips)
    .where(and(eq(clips.id, id), eq(clips.isActive, true)))
    .limit(1);

  if (!clip) {
    return NextResponse.json({ error: "ไม่พบคลิป" }, { status: 404 });
  }

  const url = await getPresignedDownloadUrl(clip.r2Key, 60);
  const totalDuration = clip.duration ?? 0;
  const teaserDuration = Math.min(10, Math.max(2, totalDuration * 0.3 || 10));
  // Start the teaser around the middle of the clip so it skips intros and
  // shows something more representative. Keep enough room before the end
  // so the full teaserDuration can play out before the file actually ends.
  // For clips shorter than the teaser + a small buffer, just start at 0.
  const teaserStartAt =
    totalDuration > teaserDuration + 2
      ? Math.max(0, totalDuration / 2 - teaserDuration / 2)
      : 0;

  return NextResponse.json({ url, teaserDuration, teaserStartAt });
}
