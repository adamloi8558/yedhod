import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db.select().from(systemConfig).where(eq(systemConfig.key, "telegram_poster_target_group"));
  console.log("current value:", JSON.stringify(rows, null, 2));

  // also list distinct target_group_id in telegram_posted_clips for context
  const { sql } = await import("drizzle-orm");
  const groups = await db.execute(sql`
    select target_group_id, count(*)::int as posts, max(created_at) as last
    from telegram_posted_clips
    group by target_group_id
    order by posts desc
  `);
  console.log("groups in telegram_posted_clips:");
  console.log((Array.isArray(groups) ? groups : (groups as any).rows));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
