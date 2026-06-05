import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../index");
  const { payments, users } = await import("../schema");
  const { sql } = await import("drizzle-orm");

  const now = new Date();
  const TODAY_BKK = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      7 * 3600 * 1000
  );
  const YESTERDAY_BKK = new Date(TODAY_BKK.getTime() - 24 * 3600 * 1000);

  console.log("Day window:", YESTERDAY_BKK.toISOString(), "→", TODAY_BKK.toISOString());

  // Count distinct users with a slip uploaded yesterday
  const distinctUsersUploaded = await db.execute(sql`
    select count(distinct user_id)::int as c
    from payments
    where slip_image_r2_key is not null
      and created_at >= ${YESTERDAY_BKK.toISOString()}
      and created_at < ${TODAY_BKK.toISOString()}
  `);
  console.log("\nDistinct users who UPLOADED a slip yesterday:", distinctUsersUploaded);

  // Per user: count of slip uploads + how many ended up completed
  const perUser = await db.execute(sql`
    select u.email,
           count(*)::int as slips_uploaded,
           count(*) filter (where p.status = 'completed')::int as completed,
           count(*) filter (where p.status = 'pending')::int as still_pending,
           count(*) filter (where p.status = 'failed')::int as failed,
           count(*) filter (where p.status = 'expired')::int as expired,
           sum(case when p.status = 'completed' then p.amount::numeric else 0 end) as completed_total
    from payments p
    left join users u on u.id = p.user_id
    where p.slip_image_r2_key is not null
      and p.created_at >= ${YESTERDAY_BKK.toISOString()}
      and p.created_at < ${TODAY_BKK.toISOString()}
    group by u.email
    order by slips_uploaded desc
  `);
  console.log("\nPer-user slip uploads yesterday:");
  console.log(perUser);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
