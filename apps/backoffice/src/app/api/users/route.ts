import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import { users, subscriptions, pricingPlans } from "@kodhom/db/schema";
import { roleEnum } from "@kodhom/db/schema";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";
import { nanoid } from "@/lib/nanoid";

const PAGE_SIZE = 30;
const VALID_ROLES = roleEnum.enumValues; // ["member","vip","admin"]

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "member" | "vip" | "admin";
  banned: boolean;
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
  // Raw db.execute(sql``) with postgres-js cannot bind a Date — use ISO string.
  const nowIso = new Date().toISOString();
  const like = `%${q}%`;

  // Correlated subqueries via raw SQL (robust): real VIP entitlement is
  // an active, non-expired subscription — not the role label.
  const listSql = q
    ? sql`
        select u.id, u.name, u.email, u.role, u.banned, u.created_at as "createdAt",
          (select max(s.end_date) from subscriptions s
            where s.user_id = u.id and s.status = 'active'
              and (s.end_date is null or s.end_date > ${nowIso})) as "vipUntil",
          exists(select 1 from subscriptions s
            where s.user_id = u.id and s.status = 'active' and s.end_date is null) as "vipLifetime"
        from users u
        where u.name ilike ${like} or u.email ilike ${like}
        order by u.created_at desc
        limit ${PAGE_SIZE} offset ${offset}
      `
    : sql`
        select u.id, u.name, u.email, u.role, u.banned, u.created_at as "createdAt",
          (select max(s.end_date) from subscriptions s
            where s.user_id = u.id and s.status = 'active'
              and (s.end_date is null or s.end_date > ${nowIso})) as "vipUntil",
          exists(select 1 from subscriptions s
            where s.user_id = u.id and s.status = 'active' and s.end_date is null) as "vipLifetime"
        from users u
        order by u.created_at desc
        limit ${PAGE_SIZE} offset ${offset}
      `;

  const countSql = q
    ? sql`select count(*)::int as total from users u where u.name ilike ${like} or u.email ilike ${like}`
    : sql`select count(*)::int as total from users`;

  try {
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
  } catch (err) {
    console.error("[users] query failed:", err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดรายชื่อผู้ใช้ได้" },
      { status: 500 }
    );
  }
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

  // Auto-grant VIP via a lifetime subscription so access control (which
  // reads `subscriptions`, not `users.role`) sees the user as active.
  // If the user already has an active subscription, we don't touch it.
  if (role === "vip") {
    const now = new Date();
    const [activeSub] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, id),
          eq(subscriptions.status, "active"),
          or(isNull(subscriptions.endDate), gt(subscriptions.endDate, now))
        )
      )
      .limit(1);

    if (!activeSub) {
      // Pick the cheapest active plan as the carrier for the manual
      // grant. We only use it to attach the row to *something* in the
      // pricing table; the lifetime endDate=null means the customer
      // keeps access regardless of plan duration.
      const [plan] = await db
        .select({ id: pricingPlans.id })
        .from(pricingPlans)
        .where(eq(pricingPlans.isActive, true))
        .orderBy(asc(pricingPlans.priceThb))
        .limit(1);
      if (plan) {
        await db.insert(subscriptions).values({
          id: nanoid(),
          userId: id,
          pricingPlanId: plan.id,
          status: "active",
          startDate: now,
          endDate: null, // lifetime
          amountPaid: "0",
          paymentRef: `admin-grant-${id}`,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
