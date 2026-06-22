import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  console.log("=== All events from 19 Jun to now (every single one) ===");
  const r = await db.execute(sql`
    select to_char(tpc.created_at, 'YYYY-MM-DD HH24:MI:SS') as t,
           tpc.status, tpc.error_message,
           c.title, round(c.file_size/1024.0/1024.0,1) as mb
    from telegram_posted_clips tpc
    join clips c on c.id = tpc.clip_id
    where tpc.created_at >= '2026-06-19'
    order by tpc.created_at desc
  `);
  console.log((Array.isArray(r) ? r : (r as any).rows));

  console.log("\n=== Active member clips created from 19 Jun onward (DB) ===");
  const c = await db.execute(sql`
    select to_char(c.created_at, 'YYYY-MM-DD HH24:MI:SS') as t,
           c.id, c.title, round(c.file_size/1024.0/1024.0,1) as mb,
           cat.name as cat_name, cat.access_level
    from clips c
    join categories cat on cat.id = c.category_id
    where c.created_at >= '2026-06-19'
      and c.is_active = true
    order by c.created_at desc
  `);
  const rows = (Array.isArray(c) ? c : (c as any).rows) ?? [];
  console.log(`Total active clips created since 19 Jun: ${rows.length}`);
  console.log(rows.slice(0, 30));

  console.log("\n=== Of those, how many are member-access? ===");
  const m = await db.execute(sql`
    select count(*)::int as c
    from clips c
    join categories cat on cat.id = c.category_id
    where c.created_at >= '2026-06-19'
      and c.is_active = true
      and cat.access_level = 'member'
      and cat.is_active = true
  `);
  console.log((Array.isArray(m) ? m : (m as any).rows));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
