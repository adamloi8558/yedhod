import { NextRequest, NextResponse } from "next/server";
import { db } from "@kodhom/db";
import {
  users,
  clips,
  subscriptions,
  payments,
  pricingPlans,
  telegramSyncMessages,
  telegramPostedClips,
} from "@kodhom/db/schema";
import { and, eq, gte, lte, lt, gt, isNotNull, isNull, or, sql, desc, count } from "drizzle-orm";
import { getAdminSession } from "@/lib/auth-server";

// Paid = enum "completed" (NOT "paid").
const PAID = "completed" as const;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();

  // Default range: this month.
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDate(searchParams.get("from")) ?? defaultFrom;
  // `to` is inclusive of the whole day → push to end of that day.
  const toRaw = parseDate(searchParams.get("to")) ?? now;
  const to = endOfDay(toRaw);

  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Raw db.execute(sql``) with postgres-js cannot bind Date objects — pass
  // ISO strings and let Postgres cast them to timestamps.
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const nowIso = now.toISOString();

  try {
  const [
    revenue,
    newPayingCustomers,
    newSubs,
    newUsers,
    activeVip,
    dailyRevenue,
    dailyUsersVsPayers,
    paymentStatusBreakdown,
    revenueByPlan,
    pendingSlips,
    paidNoVip,
    expiringVip,
    syncStatus,
    catalog,
  ] = await Promise.all([
    // --- A. Business Pulse (range) ---
    // Revenue + bill count: completed payments paid within range.
    db
      .select({
        total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        bills: count(),
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, PAID),
          gte(payments.paidAt, from),
          lte(payments.paidAt, to)
        )
      ),

    // New paying customers: users whose FIRST completed payment falls in range.
    db.execute(sql`
      select count(*)::int as c from (
        select user_id, min(paid_at) as first_paid
        from payments
        where status = ${PAID}
        group by user_id
      ) fp
      where fp.first_paid >= ${fromIso} and fp.first_paid <= ${toIso}
    `),

    // New subscriptions created in range.
    db
      .select({ c: count() })
      .from(subscriptions)
      .where(and(gte(subscriptions.createdAt, from), lte(subscriptions.createdAt, to))),

    // New users registered in range.
    db
      .select({ c: count() })
      .from(users)
      .where(and(gte(users.createdAt, from), lte(users.createdAt, to))),

    // Active VIP right now (not range): active + endDate in future (or lifetime null).
    db
      .select({ c: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          or(isNull(subscriptions.endDate), gt(subscriptions.endDate, now))
        )
      ),

    // --- B. Charts (range) ---
    // Daily revenue: completed payments grouped by paidAt day.
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${payments.paidAt}), 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        bills: count(),
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, PAID),
          gte(payments.paidAt, from),
          lte(payments.paidAt, to)
        )
      )
      .groupBy(sql`date_trunc('day', ${payments.paidAt})`)
      .orderBy(sql`date_trunc('day', ${payments.paidAt})`),

    // Daily new users vs new payers.
    db.execute(sql`
      with days as (
        select to_char(d, 'YYYY-MM-DD') as day
        from generate_series(date_trunc('day', ${fromIso}::timestamp), date_trunc('day', ${toIso}::timestamp), interval '1 day') d
      ),
      u as (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as n
        from users where created_at >= ${fromIso} and created_at <= ${toIso}
        group by 1
      ),
      p as (
        select to_char(first_paid, 'YYYY-MM-DD') as day, count(*)::int as n from (
          select user_id, min(paid_at) as first_paid from payments
          where status = ${PAID} group by user_id
        ) fp where first_paid >= ${fromIso} and first_paid <= ${toIso}
        group by 1
      )
      select days.day,
             coalesce(u.n, 0) as new_users,
             coalesce(p.n, 0) as new_payers
      from days
      left join u on u.day = days.day
      left join p on p.day = days.day
      order by days.day
    `),

    // Payment status breakdown (range, by createdAt so we see all attempts).
    db
      .select({ status: payments.status, c: count() })
      .from(payments)
      .where(and(gte(payments.createdAt, from), lte(payments.createdAt, to)))
      .groupBy(payments.status),

    // Revenue by pricing plan (range, completed).
    db
      .select({
        planName: pricingPlans.name,
        total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        bills: count(),
      })
      .from(payments)
      .innerJoin(pricingPlans, eq(payments.pricingPlanId, pricingPlans.id))
      .where(
        and(
          eq(payments.status, PAID),
          gte(payments.paidAt, from),
          lte(payments.paidAt, to)
        )
      )
      .groupBy(pricingPlans.name)
      .orderBy(desc(sql`sum(${payments.amount})`)),

    // --- C. Needs attention (current, not range) ---
    // Pending EasySlip verifications WITH a slip uploaded — those are the
    // ones an admin actually has to look at. Records without a slip are
    // half-finished attempts and just clutter the queue.
    // All-time (not bounded by the date range above) so old work doesn't
    // silently disappear into the past.
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        createdAt: payments.createdAt,
        userName: users.name,
        planName: pricingPlans.name,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(pricingPlans, eq(payments.pricingPlanId, pricingPlans.id))
      .where(
        and(
          eq(payments.status, "pending"),
          eq(payments.provider, "easyslip"),
          isNotNull(payments.slipImageR2Key)
        )
      )
      .orderBy(payments.createdAt)
      .limit(20),

    // Paid but no active VIP: users with a completed payment but no active+valid subscription.
    db.execute(sql`
      select p.user_id as "userId", u.name as "userName", u.email as email,
             max(p.paid_at) as "lastPaidAt"
      from payments p
      join users u on u.id = p.user_id
      where p.status = ${PAID}
        and not exists (
          select 1 from subscriptions s
          where s.user_id = p.user_id
            and s.status = 'active'
            and (s.end_date is null or s.end_date > ${nowIso})
        )
      group by p.user_id, u.name, u.email
      order by max(p.paid_at) desc nulls last
      limit 20
    `),

    // VIP expiring within 3 days.
    db
      .select({
        id: subscriptions.id,
        endDate: subscriptions.endDate,
        userName: users.name,
        email: users.email,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, "active"),
          isNotNull(subscriptions.endDate),
          gt(subscriptions.endDate, now),
          lt(subscriptions.endDate, in3Days)
        )
      )
      .orderBy(subscriptions.endDate)
      .limit(20),

    // Content sync status.
    Promise.all([
      db
        .select({ c: count() })
        .from(telegramSyncMessages)
        .where(eq(telegramSyncMessages.status, "failed")),
      db
        .select({ last: sql<Date>`max(${telegramSyncMessages.createdAt})` })
        .from(telegramSyncMessages),
      db
        .select({ c: count() })
        .from(telegramPostedClips)
        .where(eq(telegramPostedClips.status, "failed")),
    ]),

    // --- D. Catalog health (current) ---
    Promise.all([
      db.select({ c: count() }).from(clips).where(eq(clips.isActive, true)),
      // VIP count comes from CATEGORY.accessLevel, not clip.accessLevel —
      // that's how the entire web app gates playback (see
      // hasCategoryAccess), so the flag on the clip row was misleading
      // (it gave 77, the category-level definition gives ~7,310).
      db.execute(sql`
        select count(*)::int as c
        from clips cl
        join categories cat on cat.id = cl.category_id
        where cl.is_active = true
          and cat.is_active = true
          and cat.access_level = 'vip'
      `),
      db.select({ c: count() }).from(clips).where(eq(clips.isActive, false)),
      // categories with no active clips
      db.execute(sql`
        select count(*)::int as c from categories cat
        where cat.is_active = true
          and not exists (
            select 1 from clips cl where cl.category_id = cat.id and cl.is_active = true
          )
      `),
    ]),
  ]);

  const [syncFailed, syncLast, postFailed] = syncStatus;
  const [activeClips, vipClips, inactiveClips, emptyCats] = catalog;

  const rows = (r: unknown) =>
    (r as { rows?: unknown[] }).rows ?? (r as unknown[]);

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      revenue: Number(revenue[0]?.total ?? 0),
      bills: revenue[0]?.bills ?? 0,
      newPayingCustomers: (rows(newPayingCustomers)[0] as { c?: number })?.c ?? 0,
      newSubs: newSubs[0]?.c ?? 0,
      newUsers: newUsers[0]?.c ?? 0,
      activeVip: activeVip[0]?.c ?? 0,
    },
    series: {
      dailyRevenue: dailyRevenue.map((d) => ({
        day: d.day,
        total: Number(d.total),
        bills: d.bills,
      })),
      usersVsPayers: rows(dailyUsersVsPayers) as {
        day: string;
        new_users: number;
        new_payers: number;
      }[],
    },
    breakdowns: {
      paymentStatus: paymentStatusBreakdown.map((p) => ({
        status: p.status,
        count: p.c,
      })),
      revenueByPlan: revenueByPlan.map((p) => ({
        planName: p.planName,
        total: Number(p.total),
        bills: p.bills,
      })),
    },
    attention: {
      pendingSlips: pendingSlips.map((s) => ({
        id: s.id,
        amount: Number(s.amount),
        createdAt: s.createdAt,
        userName: s.userName,
        planName: s.planName,
      })),
      paidNoVip: rows(paidNoVip),
      expiringVip: expiringVip,
      sync: {
        syncFailed: syncFailed[0]?.c ?? 0,
        lastSyncAt: syncLast[0]?.last ?? null,
        postFailed: postFailed[0]?.c ?? 0,
      },
    },
    catalog: {
      activeClips: activeClips[0]?.c ?? 0,
      vipClips: (rows(vipClips)[0] as { c: number })?.c ?? 0,
      inactiveClips: inactiveClips[0]?.c ?? 0,
      emptyCategories: (rows(emptyCats)[0] as { c: number })?.c ?? 0,
    },
  });
  } catch (err) {
    console.error("[dashboard] query failed:", err);
    return NextResponse.json(
      { error: "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้" },
      { status: 500 }
    );
  }
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
