import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  const u = await db.execute(sql`
    select count(*)::int as total,
           count(*) filter (where c.file_size > 52428800)::int as oversized
    from clips c
    join categories cat on cat.id = c.category_id
    left join telegram_posted_clips tpc on tpc.clip_id = c.id
    where cat.access_level = 'member' and cat.is_active = true and c.is_active = true
      and tpc.id is null
  `);
  console.log((Array.isArray(u) ? u : (u as any).rows));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
