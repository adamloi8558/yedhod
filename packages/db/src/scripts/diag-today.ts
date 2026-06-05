import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../index");
  const { payments, users, pricingPlans } = await import("../schema");
  const { sql, eq, and, gte, isNotNull } = await import("drizzle-orm");

  const now = new Date();
  // Today: midnight local Bangkok = midnight UTC+7
  // To stay simple use 00:00 UTC today and let the report compare both.
  const todayStartUtc = new Date(now);
  todayStartUtc.setUTCHours(0, 0, 0, 0);
  // Bangkok midnight = UTC 17:00 of the previous day. We'll compute that.
  const todayStartBkk = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 7 * 3600 * 1000
  );

  console.log("now (UTC):", now.toISOString());
  console.log("today midnight UTC:", todayStartUtc.toISOString());
  console.log("today midnight Bangkok (in UTC):", todayStartBkk.toISOString());

  console.log("\n=== Payments table TODAY (completed only) ===");
  const completedTodayBkk = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      amount: payments.amount,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      provider: payments.provider,
      planId: payments.pricingPlanId,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.paidAt, todayStartBkk)
      )
    );
  console.log("completed (paidAt >= Bangkok midnight):", completedTodayBkk);

  const distinctPayers = await db.execute(sql`
    select count(distinct user_id)::int as c
    from payments
    where status = 'completed'
      and paid_at >= ${todayStartBkk.toISOString()}
  `);
  console.log("distinct paying users today (Bangkok day):", distinctPayers);

  console.log("\n=== Pending payments TODAY ===");
  const pendingToday = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      amount: payments.amount,
      createdAt: payments.createdAt,
      provider: payments.provider,
      hasSlip: sql<boolean>`${payments.slipImageR2Key} is not null`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "pending"),
        gte(payments.createdAt, todayStartBkk)
      )
    );
  console.log(`total ${pendingToday.length} pending records created today`);
  console.log(pendingToday.slice(0, 30));

  const pendingDistinctUsers = await db.execute(sql`
    select count(distinct user_id)::int as c
    from payments
    where status = 'pending' and created_at >= ${todayStartBkk.toISOString()}
  `);
  console.log("distinct users with pending today:", pendingDistinctUsers);

  const pendingByUserToday = await db.execute(sql`
    select user_id, count(*)::int as n
    from payments
    where status = 'pending' and created_at >= ${todayStartBkk.toISOString()}
    group by user_id
    order by n desc
    limit 20
  `);
  console.log("\nPending records per user today (top 20):");
  console.log(pendingByUserToday);

  console.log("\n=== ALL TIME revenue ===");
  const completedAll = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      bills: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(eq(payments.status, "completed"));
  console.log("all-time completed:", completedAll);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
