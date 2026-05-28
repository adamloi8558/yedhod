import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { users } from "@kodhom/db/schema";
import { roleEnum } from "@kodhom/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";

const PAGE_SIZE = 30;
const VALID_ROLES = roleEnum.enumValues; // ["member","vip","admin"]

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "member" | "vip" | "admin";
  createdAt: string;
  vipUntil: string | null;
  vipLifetime: boolean;
};

function asRows<T>(r: unknown): T[] {
  return ((r as { rows?: unknown[] }).rows ?? (r as unknown[])) as T[];
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const now = new Date();
  const like = `%${q}%`;

  // Correlated subqueries via raw SQL (robust): real VIP entitlement is
  // an active, non-expired subscription — not the role label.
  const listSql = q
    ? sql`
        select u.id, u.name, u.email, u.role, u.created_at as "createdAt",
          (select max(s.end_date) from subscriptions s
            where s.user_id = u.id and s.status = 'active'
              and (s.end_date is null or s.end_date > ${now})) as "vipUntil",
          exists(select 1 from subscriptions s
            where s.user_id = u.id and s.status = 'active' and s.end_date is null) as "vipLifetime"
        from users u
        where u.name ilike ${like} or u.email ilike ${like}
        order by u.created_at desc
        limit ${PAGE_SIZE} offset ${offset}
      `
    : sql`
        select u.id, u.name, u.email, u.role, u.created_at as "createdAt",
          (select max(s.end_date) from subscriptions s
            where s.user_id = u.id and s.status = 'active'
              and (s.end_date is null or s.end_date > ${now})) as "vipUntil",
          exists(select 1 from subscriptions s
            where s.user_id = u.id and s.status = 'active' and s.end_date is null) as "vipLifetime"
        from users u
        order by u.created_at desc
        limit ${PAGE_SIZE} offset ${offset}
      `;

  const countSql = q
    ? sql`select count(*)::int as total from users u where u.name ilike ${like} or u.email ilike ${like}`
    : sql`select count(*)::int as total from users`;

  const [listRes, totalRes] = await Promise.all([
    db.execute(listSql),
    db.execute(countSql),
  ]);

  const rows = asRows<UserRow>(listRes);
  const total = asRows<{ total: number }>(totalRes)[0]?.total ?? 0;

  return NextResponse.json({
    users: rows.map((u) => ({
      ...u,
      isVipActive: !!u.vipLifetime || !!u.vipUntil,
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
