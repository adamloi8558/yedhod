/** Read-only report. Resolve payments through the audited backoffice approval flow.
 * The old --apply path could credit provider duplicates and expire unrelated orders.
 * Usage: pnpm --filter @kodhom/telegram-sync exec tsx ../web/scripts/reverify-pending-slips.ts
 */
import { config } from "dotenv";
config({ path: "../../.env" });
async function main() {
  if (process.argv.includes("--apply")) throw new Error("Bulk credit disabled: review each bank transfer and reconcile existing grants in backoffice Payments");
  const { db } = await import("@kodhom/db");
  const { sql } = await import("drizzle-orm");
  const rows = await db.execute(sql`
    select p.id, p.amount, p.created_at, p.expires_at,
      (select a.metadata->>'code' from admin_audit_logs a
       where a.target_type='payment' and a.target_id=p.id and a.action='payment.verify'
       order by a.created_at desc limit 1) as last_error
    from payments p where p.provider='easyslip' and p.status='pending'
      and p.slip_image_r2_key is not null order by p.created_at asc
  `);
  console.log(JSON.stringify(rows, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
