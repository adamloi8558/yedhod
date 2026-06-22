import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  // Remove every prior row where the clip was rejected for size — the
  // new code will revisit them and build a preview.
  const r = await db.execute(sql`
    delete from telegram_posted_clips
    where (status = 'skipped' and error_message ilike '%File too large%')
       or (error_message ilike 'link-only%')
       or (error_message ilike 'preview-build-failed%')
    returning id
  `);
  const rows = (Array.isArray(r) ? r : (r as any).rows) ?? [];
  console.log(`Deleted ${rows.length} rows — poster will retry with preview`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
