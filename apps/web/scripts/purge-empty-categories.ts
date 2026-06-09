/**
 * Purge categories that have zero active clips AND no active children.
 *
 * A "leaf" empty category (no clips, no children) is safe to delete.
 * A parent category that has only empty children would also be empty
 * after we delete those children, so we iterate until the set stops
 * shrinking.
 *
 * Run:
 *   npx tsx apps/web/scripts/purge-empty-categories.ts           # dry
 *   npx tsx apps/web/scripts/purge-empty-categories.ts --apply
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { inArray, sql } from "drizzle-orm";

interface Row {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

async function findEmpty(): Promise<Row[]> {
  const r = await db.execute(sql`
    select c.id, c.name, c.slug, c.parent_id
    from categories c
    where c.is_active = true
      and not exists (
        select 1 from clips cl
        where cl.category_id = c.id and cl.is_active = true
      )
      and not exists (
        select 1 from categories ch
        where ch.parent_id = c.id and ch.is_active = true
      )
  `);
  return (Array.isArray(r) ? r : (r as unknown as { rows: Row[] }).rows) as Row[];
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(dryRun ? "(DRY RUN — pass --apply to delete)" : "*** APPLYING ***");

  let totalRemoved = 0;
  let round = 1;
  while (true) {
    const empties = await findEmpty();
    if (empties.length === 0) break;
    console.log(`\n── round ${round}: ${empties.length} empty categories`);
    for (const c of empties) {
      console.log(
        `  ${c.id.slice(0, 8)}  ${c.name}  (slug=${c.slug}, parent=${c.parent_id ? c.parent_id.slice(0, 8) : "—"})`
      );
    }
    if (dryRun) {
      console.log(`  (would delete ${empties.length})`);
      break;
    }
    // Soft delete — `telegram_sync_messages.category_id` references this
    // table without ON DELETE so hard delete would fail. Setting
    // is_active=false hides the category everywhere in the customer-
    // facing UI (sidebar, /categories, /category/[slug], counts) and
    // preserves the FK chain for historical syncs.
    const ids = empties.map((c) => c.id);
    await db
      .update(categories)
      .set({ isActive: false })
      .where(inArray(categories.id, ids));
    totalRemoved += ids.length;
    round++;
    // Loop again — a parent might now be empty (because its children
    // just got hidden).
  }

  console.log(`\nTotal removed: ${totalRemoved}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
