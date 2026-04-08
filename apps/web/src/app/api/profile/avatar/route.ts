import { NextRequest, NextResponse } from "next/server";
import { auth } from "@kodhom/auth";
import { db } from "@kodhom/db";
import { users } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getPublicUrl } from "@kodhom/r2";

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { r2Key } = await req.json();
  if (!r2Key) {
    return NextResponse.json({ error: "r2Key required" }, { status: 400 });
  }

  const imageUrl = getPublicUrl(r2Key);

  await db
    .update(users)
    .set({ image: imageUrl, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ image: imageUrl });
}
