import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { users, subscriptions } from "@kodhom/db/schema";
import { roleEnum } from "@kodhom/db/schema";
import { eq, or, ilike, desc, count, sql } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";

const PAGE_SIZE = 30;
const VALID_ROLES = roleEnum.enumValues; // ["member","vip","admin"]

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const now = new Date();

  const where = q
    ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
    : undefined;

  // Latest active, non-expired subscription end date per user (the source of
  // truth for "VIP that actually works" — role is just a label).
  const activeSubEnd = sql<Date | null>`(
    select max(${subscriptions.endDate})
    from ${subscriptions}
    where ${subscriptions.userId} = ${users.id}
      and ${subscriptions.status} = 'active'
      and (${subscriptions.endDate} is null or ${subscriptions.endDate} > ${now})
  )`;
  // A lifetime (null endDate) active sub also counts as VIP.
  const hasLifetime = sql<boolean>`exists (
    select 1 from ${subscriptions}
    where ${subscriptions.userId} = ${users.id}
      and ${subscriptions.status} = 'active'
      and ${subscriptions.endDate} is null
  )`;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        vipUntil: activeSubEnd,
        vipLifetime: hasLifetime,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(users).where(where),
  ]);

  return NextResponse.json({
    users: rows.map((u) => ({
      ...u,
      // real entitlement, independent of role label
      isVipActive: u.vipLifetime || !!u.vipUntil,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, role } = await req.json();
  if (!id || !role) {
    return NextResponse.json({ error: "id and role required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json(
      { error: `role ต้องเป็น ${VALID_ROLES.join(" / ")}` },
      { status: 400 }
    );
  }

  await db.update(users).set({ role }).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
