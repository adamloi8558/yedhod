import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== Failed clips with size and duration ===");
  const r = await db.execute(sql`
    select tpc.created_at, tpc.error_message,
           c.id, c.title,
           c.file_size,
           round(c.file_size / 1024.0 / 1024.0, 1) as mb,
           c.duration
    from telegram_posted_clips tpc
    join clips c on c.id = tpc.clip_id
    where tpc.status = 'failed'
    order by tpc.created_at desc
    limit 15
  `);
  const rows = (Array.isArray(r) ? r : (r as any).rows) ?? [];
  console.log(rows);

  console.log("\n=== Unposted clips waiting (next 5) ===");
  const u = await db.execute(sql`
    select c.id, c.title, round(c.file_size / 1024.0 / 1024.0, 1) as mb, c.duration, c.created_at
    from clips c
    join categories cat on cat.id = c.category_id
    left join telegram_posted_clips tpc on tpc.clip_id = c.id
    where cat.access_level = 'member' and cat.is_active = true and c.is_active = true
      and tpc.id is null
    order by c.created_at
    limit 5
  `);
  const urows = (Array.isArray(u) ? u : (u as any).rows) ?? [];
  console.log(urows);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
