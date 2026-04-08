import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { users } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);
  return NextResponse.json(allUsers);
}

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, role } = await req.json();
  if (!id || !role) {
    return NextResponse.json({ error: "id and role required" }, { status: 400 });
  }

  await db.update(users).set({ role }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
