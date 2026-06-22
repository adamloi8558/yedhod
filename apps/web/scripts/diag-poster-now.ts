import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Last 10 telegram_posted_clips events (any status) ===");
  const last = await db.execute(sql`
    select tpc.created_at, tpc.status, tpc.error_message,
           c.id as clip_id, c.title,
           round(c.file_size / 1024.0 / 1024.0, 1) as mb
    from telegram_posted_clips tpc
    join clips c on c.id = tpc.clip_id
    order by tpc.created_at desc
    limit 10
  `);
  console.log((Array.isArray(last) ? last : (last as any).rows));

  console.log("\n=== Currently unposted member clips (waiting in queue) ===");
  const u = await db.execute(sql`
    select c.id, c.title, round(c.file_size / 1024.0 / 1024.0, 1) as mb, c.created_at,
           cat.name as cat_name
    from clips c
    join categories cat on cat.id = c.category_id
    left join telegram_posted_clips tpc on tpc.clip_id = c.id
    where cat.access_level = 'member' and cat.is_active = true and c.is_active = true
      and tpc.id is null
    order by c.created_at
    limit 20
  `);
  const rows = (Array.isArray(u) ? u : (u as any).rows) ?? [];
  console.log(`Unposted: ${rows.length}`);
  console.log(rows);

  console.log("\n=== Time since last poster activity ===");
  const lastActivity = await db.execute(sql`
    select max(created_at) as last_activity,
           now() - max(created_at) as idle_for
    from telegram_posted_clips
  `);
  console.log((Array.isArray(lastActivity) ? lastActivity : (lastActivity as any).rows));

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
