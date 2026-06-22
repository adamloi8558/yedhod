import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  const r = await db.execute(sql`
    select tpc.created_at, tpc.status, tpc.error_message, c.title, round(c.file_size/1024.0/1024.0,1) as mb
    from telegram_posted_clips tpc
    join clips c on c.id = tpc.clip_id
    where tpc.created_at >= '2026-06-22'
    order by tpc.created_at desc
  `);
  console.log((Array.isArray(r) ? r : (r as any).rows));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
