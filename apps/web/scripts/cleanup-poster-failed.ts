import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "*** APPLYING ***" : "(DRY RUN)");

  // Delete 'failed' rows whose error is 'terminated' or network failed —
  // those represent runs that crashed before reaching the size check.
  // After the new pre-flight ships, the poster will revisit those clips
  // and either skip-with-reason or post them.
  const targetSql = sql`
    delete from telegram_posted_clips
    where status = 'failed'
      and (error_message = 'terminated'
           or error_message ilike '%Network request%failed%')
    returning id, clip_id, error_message
  `;
  if (!apply) {
    const peek = await db.execute(sql`
      select id, clip_id, error_message
      from telegram_posted_clips
      where status = 'failed'
        and (error_message = 'terminated'
             or error_message ilike '%Network request%failed%')
    `);
    const rows = (Array.isArray(peek) ? peek : (peek as any).rows) ?? [];
    console.log(`Would delete ${rows.length} rows`);
    console.log(rows);
    process.exit(0);
  }
  const r = await db.execute(targetSql);
  const rows = (Array.isArray(r) ? r : (r as any).rows) ?? [];
  console.log(`Deleted ${rows.length} rows`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
