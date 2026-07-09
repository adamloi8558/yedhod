import "dotenv/config";
import { db } from "../src/index";
import { categories } from "../src/schema";
import { isNull, sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .where(isNull(categories.parentId));

  console.log(`orphan (top-level) categories: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.slug.padEnd(50)} | ${r.name}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
