import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clipReactions, clipStats } from "@kodhom/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";

// Toggle a heart on a clip. Login required — one heart per user, ever.
// We keep `like_count` denormalized on clip_stats so the catalogue can
// sort/render without a join.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const userId = session.user.id;

  // Check current state — single row lookup via composite PK.
  const existing = await db
    .select({ clipId: clipReactions.clipId })
    .from(clipReactions)
    .where(and(eq(clipReactions.clipId, id), eq(clipReactions.userId, userId)))
    .limit(1);

  const liked = existing.length > 0;

  if (liked) {
    await db
      .delete(clipReactions)
      .where(
        and(eq(clipReactions.clipId, id), eq(clipReactions.userId, userId))
      );
  } else {
    await db.insert(clipReactions).values({ clipId: id, userId });
  }

  // Keep the denormalized count in sync. Upsert so a clip without any
  // existing stats row still gets one created.
  const delta = liked ? -1 : 1;
  const [row] = await db
    .insert(clipStats)
    .values({ clipId: id, likeCount: Math.max(0, delta) })
    .onConflictDoUpdate({
      target: clipStats.clipId,
      set: {
        likeCount: sql`greatest(0, ${clipStats.likeCount} + ${delta})`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ likeCount: clipStats.likeCount });

  return NextResponse.json({ liked: !liked, likeCount: row?.likeCount ?? 0 });
}
