import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  console.log("=== Member clips since 19 Jun ===");
  const r = await db.execute(sql`
    select to_char(c.created_at, 'MM-DD HH24:MI') as t,
           c.id, c.title, round(c.file_size/1024.0/1024.0,1) as mb,
           cat.name as cat_name,
           coalesce(tpc.status, '(no row)') as poster_status,
           tpc.error_message
    from clips c
    join categories cat on cat.id = c.category_id
    left join telegram_posted_clips tpc on tpc.clip_id = c.id
    where c.created_at >= '2026-06-19'
      and c.is_active = true
      and cat.access_level = 'member'
      and cat.is_active = true
    order by c.created_at desc
  `);
  console.log((Array.isArray(r) ? r : (r as any).rows));

  console.log("\n=== VIP-access clips since 19 Jun (NOT posted to group) ===");
  const v = await db.execute(sql`
    select count(*)::int as c, count(distinct cat.name)::int as cats
    from clips c
    join categories cat on cat.id = c.category_id
    where c.created_at >= '2026-06-19'
      and c.is_active = true
      and cat.access_level = 'vip'
      and cat.is_active = true
  `);
  console.log((Array.isArray(v) ? v : (v as any).rows));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
