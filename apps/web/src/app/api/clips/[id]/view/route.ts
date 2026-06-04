import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clipStats } from "@kodhom/db/schema";
import { sql } from "drizzle-orm";

// Bump a clip's view counter. Open to everyone — the goal is to make the
// catalogue feel busier than a tiny audience actually warrants, so we add
// a random 1-10 per call rather than +1. The recent-views bucket gets the
// same bump and is what powers the "🔥 trending in 24h" sort.
//
// We rely on the unique PK upsert (ON CONFLICT) instead of a "select then
// insert/update" round-trip — this is racy-safe and stays one query.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Random integer 1..10 inclusive.
  const inflate = 1 + Math.floor(Math.random() * 10);

  try {
    const [row] = await db
      .insert(clipStats)
      .values({
        clipId: id,
        viewCount: inflate,
        recentViews: inflate,
      })
      .onConflictDoUpdate({
        target: clipStats.clipId,
        set: {
          viewCount: sql`${clipStats.viewCount} + ${inflate}`,
          recentViews: sql`${clipStats.recentViews} + ${inflate}`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ viewCount: clipStats.viewCount });

    return NextResponse.json({ viewCount: row?.viewCount ?? inflate });
  } catch {
    // Counter is opportunistic — never break playback over a write failure.
    return NextResponse.json({ viewCount: null }, { status: 200 });
  }
}
