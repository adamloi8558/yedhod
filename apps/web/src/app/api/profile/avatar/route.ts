import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { users } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPublicUrl } from "@kodhom/r2";
import { getSession } from "@/lib/auth-server";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { r2Key } = await req.json();
  if (!r2Key) {
    return NextResponse.json({ error: "r2Key required" }, { status: 400 });
  }

  if (typeof r2Key !== "string" || !r2Key.startsWith("avatars/")) {
    return NextResponse.json({ error: "ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const imageUrl = getPublicUrl(r2Key);

  await db
    .update(users)
    .set({ image: imageUrl, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ image: imageUrl });
}
