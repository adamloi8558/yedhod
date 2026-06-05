/**
 * Audit revenue for a date window. For each completed payment we print:
 *   - user
 *   - amount, paidAt
 *   - easyslip transRef
 *   - how it became completed (script_recover / manual_approve /
 *     auto / unknown)
 * Then cross-check that:
 *   - no two completed payments share the same transRef
 *   - every completed payment has a corresponding subscription
 *   - no transRef appears twice across different users
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  // Window: 4 Jun 00:00 Bangkok → 6 Jun 23:59 Bangkok (= 7 Jun 00:00 UTC -7)
  // Use UTC offsets to be precise: Bangkok = UTC+7
  const fromIso = "2026-06-03T17:00:00Z"; // 4 Jun 00:00 Bangkok
  const toIso = "2026-06-06T17:00:00Z";   // 7 Jun 00:00 Bangkok (exclusive)

  console.log(`Window (Bangkok): 2026-06-04 to 2026-06-06`);
  console.log(`UTC: ${fromIso} → ${toIso}\n`);

  console.log("=== Completed payments in window ===");
  const completed = await db.execute(sql`
    select p.id,
           u.email,
           p.amount,
           p.paid_at,
           p.easyslip_trans_ref as ref,
           p.provider,
           (select aal.action from admin_audit_logs aal
             where aal.target_id = p.id
               and aal.target_type = 'payment'
             order by aal.created_at desc limit 1) as last_admin_action
    from payments p
    join users u on u.id = p.user_id
    where p.status = 'completed'
      and p.paid_at >= ${fromIso}
      and p.paid_at < ${toIso}
    order by p.paid_at
  `);
  const completedRows = Array.isArray(completed)
    ? completed
    : (completed as unknown as { rows: unknown[] }).rows;
  console.log(`Count: ${completedRows?.length ?? 0}`);
  console.log(completedRows);

  console.log("\n=== Duplicate transRefs in window ===");
  const dups = await db.execute(sql`
    select p.easyslip_trans_ref as ref,
           array_agg(p.id) as payment_ids,
           array_agg(u.email) as emails,
           count(*)::int as n
    from payments p
    join users u on u.id = p.user_id
    where p.status = 'completed'
      and p.paid_at >= ${fromIso}
      and p.paid_at < ${toIso}
      and p.easyslip_trans_ref is not null
    group by p.easyslip_trans_ref
    having count(*) > 1
  `);
  const dupRows = Array.isArray(dups)
    ? dups
    : (dups as unknown as { rows: unknown[] }).rows;
  console.log(`Duplicates: ${dupRows?.length ?? 0}`);
  console.log(dupRows);

  console.log("\n=== Completed payments WITHOUT a subscription ===");
  const orphans = await db.execute(sql`
    select p.id, u.email, p.amount, p.paid_at, p.easyslip_trans_ref as ref
    from payments p
    join users u on u.id = p.user_id
    where p.status = 'completed'
      and p.paid_at >= ${fromIso}
      and p.paid_at < ${toIso}
      and not exists (
        select 1 from subscriptions s
        where s.user_id = p.user_id
          and (s.payment_ref = p.easyslip_trans_ref
               or s.payment_ref = p.id
               or s.payment_ref = ('manual-' || p.id))
      )
    order by p.paid_at
  `);
  const orphanRows = Array.isArray(orphans)
    ? orphans
    : (orphans as unknown as { rows: unknown[] }).rows;
  console.log(`Orphans: ${orphanRows?.length ?? 0}`);
  console.log(orphanRows);

  console.log("\n=== Summary by action ===");
  const summary = await db.execute(sql`
    select coalesce(
             (select aal.action from admin_audit_logs aal
              where aal.target_id = p.id and aal.target_type = 'payment'
              order by aal.created_at desc limit 1),
             'auto_or_legacy'
           ) as action,
           count(*)::int as n,
           sum(p.amount::numeric) as total
    from payments p
    where p.status = 'completed'
      and p.paid_at >= ${fromIso}
      and p.paid_at < ${toIso}
    group by 1
    order by n desc
  `);
  const summaryRows = Array.isArray(summary)
    ? summary
    : (summary as unknown as { rows: unknown[] }).rows;
  console.log(summaryRows);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
