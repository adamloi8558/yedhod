import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { clips } from "@kodhom/db/schema";
import { clipSchema } from "@kodhom/validators";
import { nanoid } from "@/lib/nanoid";
import { getAdminSession } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = clipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = nanoid();
  await db.insert(clips).values({ id, ...parsed.data });

  return NextResponse.json({ id });
}
