/**
 * Find users whom the admin manually approved more than once in this
 * audit window. Anyone who actually transferred N times would have a
 * distinct easyslip_trans_ref per row; rows with ref=null are records
 * that the admin clicked Approve on without a verified slip. Those are
 * the false approvals we need to roll back.
 *
 * Rollback per user:
 *   - keep the OLDEST approved payment + its subscription
 *   - revert the other payments to status='failed' + clear paidAt
 *   - delete the orphan subscriptions
 *   - audit-log each rollback
 *
 * We never touch script_recover entries — those came through
 * reverify-pending-slips and are tied to a real EasySlip transRef.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { payments, subscriptions, adminAuditLogs } from "@kodhom/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface Group {
  email: string;
  user_id: string;
  payment_ids: string[];
  paid_ats: string[];
  refs: (string | null)[];
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(dryRun ? "(DRY RUN — pass --apply to commit)" : "*** APPLYING ***");

  const fromIso = "2026-06-03T17:00:00Z";
  const toIso = "2026-06-06T17:00:00Z";

  // Group manual-approved payments by user.
  const grouped = await db.execute(sql`
    select u.email,
           p.user_id,
           array_agg(p.id order by p.paid_at) as payment_ids,
           array_agg(to_char(p.paid_at, 'YYYY-MM-DD HH24:MI:SS') order by p.paid_at) as paid_ats,
           array_agg(p.easyslip_trans_ref order by p.paid_at) as refs
    from payments p
    join users u on u.id = p.user_id
    where p.status = 'completed'
      and p.paid_at >= ${fromIso}
      and p.paid_at < ${toIso}
      and exists (
        select 1 from admin_audit_logs aal
        where aal.target_id = p.id
          and aal.target_type = 'payment'
          and aal.action = 'payment.manual_approve'
      )
    group by u.email, p.user_id
    having count(*) > 1
  `);
  const groupRows = (Array.isArray(grouped)
    ? grouped
    : (grouped as unknown as { rows: Group[] }).rows) as Group[];

  console.log(`Found ${groupRows.length} users with > 1 manual approve in window`);

  let rolledBack = 0;
  for (const g of groupRows) {
    // Decide which payment to KEEP: the earliest one. Everything else
    // is a duplicate caused by clicking Approve on every duplicate row.
    const [keep, ...drop] = g.payment_ids;
    console.log(
      `\n${g.email} — keep ${keep.slice(0, 8)} (${g.paid_ats[0]}); drop ${drop.length} others`
    );
    if (dryRun) {
      console.log("  (would revert)", drop);
      continue;
    }

    for (const pid of drop) {
      try {
        await db.transaction(async (tx) => {
          // Subscription matching this payment — payment_ref could be the
          // payment id or 'manual-<id>' depending on which approve path.
          await tx.execute(sql`
            delete from subscriptions
            where user_id = ${g.user_id}
              and (payment_ref = ${pid} or payment_ref = ${"manual-" + pid})
          `);
          await tx
            .update(payments)
            .set({ status: "failed", paidAt: null })
            .where(eq(payments.id, pid));
          await tx.insert(adminAuditLogs).values({
            id: crypto.randomUUID(),
            adminId: null,
            action: "payment.script_rollback",
            targetType: "payment",
            targetId: pid,
            metadata: {
              reason: "duplicate manual approve",
              keeperPaymentId: keep,
              source: "rollback-duplicate-approves",
            },
          });
        });
        console.log(`  ✓ rolled back ${pid}`);
        rolledBack++;
      } catch (e) {
        console.log(`  ✗ ${pid}`, (e as Error).message);
      }
    }
  }

  // Sanity: also catch the case where a user has multiple ACTIVE
  // subscriptions (often the symptom of duplicate approves). Keep only
  // the one with the latest end_date and cancel the rest.
  console.log("\n=== Users with multiple active subscriptions ===");
  const multi = await db.execute(sql`
    select user_id, count(*)::int as n
    from subscriptions
    where status = 'active'
    group by user_id
    having count(*) > 1
  `);
  const multiRows = (Array.isArray(multi)
    ? multi
    : (multi as unknown as { rows: { user_id: string; n: number }[] }).rows) as {
    user_id: string;
    n: number;
  }[];
  console.log(`Found ${multiRows.length} users with > 1 active sub`);

  for (const row of multiRows) {
    const subs = await db.execute(sql`
      select id, status, start_date, end_date, payment_ref
      from subscriptions
      where user_id = ${row.user_id} and status = 'active'
      order by end_date desc nulls first, start_date desc
    `);
    const subList = (Array.isArray(subs)
      ? subs
      : (subs as unknown as { rows: { id: string }[] }).rows) as {
      id: string;
    }[];
    const [keepSub, ...dropSubs] = subList;
    console.log(`  user ${row.user_id.slice(0, 8)}: keep ${keepSub.id.slice(0, 8)}, cancel ${dropSubs.length}`);
    if (dryRun) continue;
    for (const s of dropSubs) {
      await db
        .update(subscriptions)
        .set({ status: "cancelled" })
        .where(eq(subscriptions.id, s.id));
    }
  }
  // silence the unused import lint
  void and;
  console.log(`\nSummary: rolled-back payments = ${rolledBack}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
