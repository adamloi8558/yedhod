/**
 * After running reverify-pending-slips and granting subscriptions,
 * expire any leftover pending payments that the user clearly doesn't
 * need anymore — i.e. users who now have an active subscription.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(dryRun ? "(DRY RUN)" : "*** APPLYING ***");

  const targets = await db.execute(sql`
    select p.id, p.user_id, p.amount, p.created_at, u.email
    from payments p
    join users u on u.id = p.user_id
    where p.status = 'pending'
      and p.provider = 'easyslip'
      and p.slip_image_r2_key is not null
      and exists (
        select 1 from subscriptions s
        where s.user_id = p.user_id and s.status = 'active'
      )
    order by p.user_id, p.created_at
  `);
  const rows = Array.isArray(targets) ? targets : (targets as unknown as { rows: unknown[] }).rows;
  console.log(`Found ${rows?.length ?? 0} duplicate pendings for users who already have VIP`);
  console.log(rows);

  if (!dryRun && rows && rows.length > 0) {
    const expired = await db.execute(sql`
      update payments
      set status = 'expired'
      where status = 'pending'
        and provider = 'easyslip'
        and slip_image_r2_key is not null
        and user_id in (
          select distinct user_id from subscriptions where status = 'active'
        )
      returning id
    `);
    const exp = Array.isArray(expired) ? expired : (expired as unknown as { rows: unknown[] }).rows;
    console.log(`Expired ${exp?.length ?? 0} records`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
