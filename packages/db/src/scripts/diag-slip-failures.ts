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

  console.log("Window:", YESTERDAY_BKK.toISOString(), "→", TODAY_BKK.toISOString());

  // All payments that had a slip attached yesterday (regardless of status)
  console.log("\n=== Payments with slip uploaded yesterday ===");
  const slipped = await db.execute(sql`
    select p.id, p.user_id, p.status, p.amount, p.slip_image_r2_key as slip,
           p.easyslip_trans_ref as trans_ref,
           p.paid_at, p.created_at,
           p.account_snapshot->>'bankCode' as expected_bank,
           p.account_snapshot->>'accountNumber' as expected_account,
           u.email
    from payments p
    left join users u on u.id = p.user_id
    where p.created_at >= ${YESTERDAY_BKK.toISOString()}
      and p.created_at < ${TODAY_BKK.toISOString()}
      and p.slip_image_r2_key is not null
    order by p.created_at desc
  `);
  console.log(slipped);

  console.log("\n=== Summary by status ===");
  const byStatus = await db.execute(sql`
    select p.status, count(*)::int as n
    from payments p
    where p.created_at >= ${YESTERDAY_BKK.toISOString()}
      and p.created_at < ${TODAY_BKK.toISOString()}
      and p.slip_image_r2_key is not null
    group by p.status
  `);
  console.log(byStatus);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
