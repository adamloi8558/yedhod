import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";
async function main() {
  const apply = process.argv.includes("--apply");
  const target = sql`
    delete from telegram_posted_clips
    where status = 'skipped'
      and error_message ilike '%File too large%'
    returning id
  `;
  if (!apply) {
    const peek = await db.execute(sql`
      select count(*)::int as c from telegram_posted_clips
      where status = 'skipped' and error_message ilike '%File too large%'
    `);
    console.log("Would delete:", (Array.isArray(peek) ? peek : (peek as any).rows));
    process.exit(0);
  }
  const r = await db.execute(target);
  const rows = (Array.isArray(r) ? r : (r as any).rows) ?? [];
  console.log(`Deleted ${rows.length} skipped rows — poster will re-post them as links`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
