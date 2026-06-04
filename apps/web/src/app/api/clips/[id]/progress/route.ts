import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { watchProgress } from "@kodhom/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";

// Save the user's playback position so they can resume on another device.
// Guests skip the network round-trip and write to localStorage on the
// client; this endpoint is login-only.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { position?: number; duration?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const position = Number(body.position);
  const duration = body.duration == null ? null : Number(body.duration);
  if (!Number.isFinite(position) || position < 0) {
    return NextResponse.json({ error: "bad position" }, { status: 400 });
  }

  await db
    .insert(watchProgress)
    .values({
      userId: session.user.id,
      clipId: id,
      positionSec: position,
      durationSec: duration && Number.isFinite(duration) ? duration : null,
    })
    .onConflictDoUpdate({
      target: [watchProgress.userId, watchProgress.clipId],
      set: {
        positionSec: position,
        durationSec:
          duration && Number.isFinite(duration) ? duration : sql`${watchProgress.durationSec}`,
        updatedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ position: 0 });

  const [row] = await db
    .select({
      position: watchProgress.positionSec,
      duration: watchProgress.durationSec,
    })
    .from(watchProgress)
    .where(
      and(eq(watchProgress.userId, session.user.id), eq(watchProgress.clipId, id))
    )
    .limit(1);

  return NextResponse.json({
    position: row?.position ?? 0,
    duration: row?.duration ?? null,
  });
}
