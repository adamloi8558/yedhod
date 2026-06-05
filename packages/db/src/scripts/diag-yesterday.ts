import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../index");
  const { payments, users } = await import("../schema");
  const { sql, eq, and, gte, lt } = await import("drizzle-orm");

  const now = new Date();
  // Bangkok day boundaries
  // Today midnight Bangkok = UTC date with 17:00 of "previous UTC day"
  // We treat Bangkok as UTC+7.
  const TODAY_BKK = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      7 * 3600 * 1000
  );
  // Yesterday Bangkok = TODAY_BKK - 24h
  const YESTERDAY_BKK = new Date(TODAY_BKK.getTime() - 24 * 3600 * 1000);

  console.log("Window for 'เมื่อวาน' (Bangkok day):");
  console.log("  from:", YESTERDAY_BKK.toISOString(), "(00:00 Bangkok)");
  console.log("  to:", TODAY_BKK.toISOString(), "(00:00 Bangkok next day)");

  // Completed yesterday
  const completedYday = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      amount: payments.amount,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      provider: payments.provider,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.paidAt, YESTERDAY_BKK),
        lt(payments.paidAt, TODAY_BKK)
      )
    );
  console.log("\n=== Completed yesterday ===");
  console.log(completedYday);

  const distinctPaidYday = await db.execute(sql`
    select count(distinct user_id)::int as c
    from payments
    where status = 'completed'
      and paid_at >= ${YESTERDAY_BKK.toISOString()}
      and paid_at < ${TODAY_BKK.toISOString()}
  `);
  console.log("distinct paying users yesterday:", distinctPaidYday);

  // Pending records created yesterday (attempts)
  const pendingYdayByUser = await db.execute(sql`
    select p.user_id,
           u.name as user_name,
           u.email as user_email,
           count(*)::int as attempts,
           bool_or(p.slip_image_r2_key is not null) as has_any_slip
    from payments p
    left join users u on u.id = p.user_id
    where p.status = 'pending'
      and p.created_at >= ${YESTERDAY_BKK.toISOString()}
      and p.created_at < ${TODAY_BKK.toISOString()}
    group by p.user_id, u.name, u.email
    order by attempts desc
  `);
  console.log("\n=== Pending attempts yesterday (per user) ===");
  console.log(pendingYdayByUser);

  const distinctPendingYday = await db.execute(sql`
    select count(distinct user_id)::int as c
    from payments
    where status = 'pending'
      and created_at >= ${YESTERDAY_BKK.toISOString()}
      and created_at < ${TODAY_BKK.toISOString()}
  `);
  console.log("distinct users who STARTED (pending) yesterday:", distinctPendingYday);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
