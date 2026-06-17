import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

function asRows<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  return (r as { rows?: T[] }).rows ?? [];
}

async function main() {
  console.log("=== telegram_posted_clips by status (last 30 days) ===");
  const byStatus = await db.execute(sql`
    select status, count(*)::int as n, min(created_at) as first, max(created_at) as last
    from telegram_posted_clips
    where created_at >= now() - interval '30 days'
    group by status
    order by n desc
  `);
  console.log(asRows(byStatus));

  console.log("\n=== posted clips per day (last 20 days) ===");
  const byDay = await db.execute(sql`
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
           count(*) filter (where status = 'posted')::int as posted,
           count(*) filter (where status = 'pending')::int as pending,
           count(*) filter (where status = 'failed')::int as failed,
           count(*)::int as total
    from telegram_posted_clips
    where created_at >= now() - interval '20 days'
    group by 1
    order by 1 desc
  `);
  console.log(asRows(byDay));

  console.log("\n=== last 10 failed clips ===");
  const lastFailed = await db.execute(sql`
    select id, clip_id, status, error_message, created_at
    from telegram_posted_clips
    where status = 'failed'
    order by created_at desc
    limit 10
  `);
  console.log(asRows(lastFailed));

  console.log("\n=== last 10 pending clips ===");
  const lastPending = await db.execute(sql`
    select id, clip_id, status, error_message, created_at
    from telegram_posted_clips
    where status = 'pending'
    order by created_at desc
    limit 10
  `);
  console.log(asRows(lastPending));

  console.log("\n=== last 5 successful posts (when did it actually run last) ===");
  const lastPosted = await db.execute(sql`
    select id, clip_id, status, created_at, posted_at
    from telegram_posted_clips
    where status = 'posted'
    order by created_at desc
    limit 5
  `);
  console.log(asRows(lastPosted));

  console.log("\n=== active clips with no telegram_posted_clips row at all ===");
  const orphans = await db.execute(sql`
    select count(*)::int as c
    from clips c
    where c.is_active = true
      and c.created_at >= now() - interval '30 days'
      and not exists (
        select 1 from telegram_posted_clips tpc where tpc.clip_id = c.id
      )
  `);
  console.log(asRows(orphans));

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
