import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  // 1. Anything posted as a link-only message — re-mark as 'skipped' so
  //    the queue is consistent with the new "video-only" rule, and the
  //    poster doesn't reconsider them.
  const r1 = await db.execute(sql`
    update telegram_posted_clips
    set status = 'skipped',
        error_message = regexp_replace(error_message, '^link-only', 'File too large')
    where status = 'posted'
      and error_message like 'link-only%'
    returning id, clip_id, telegram_message_id
  `);
  const rows = (Array.isArray(r1) ? r1 : (r1 as any).rows) ?? [];
  console.log(`Re-marked ${rows.length} link-only rows as skipped`);
  console.log(rows);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
