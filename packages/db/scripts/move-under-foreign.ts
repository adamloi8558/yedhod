import "dotenv/config";
import { db } from "../src/index";
import { categories } from "../src/schema";
import { and, eq, inArray, like, ne, or, sql } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
// usage:  script <keyword> <parent-name-or-slug>  [--apply]
const KEYWORD = process.argv[2] && !process.argv[2].startsWith("--")
  ? process.argv[2]
  : "chaturbate";
const PARENT_QUERY = process.argv[3] && !process.argv[3].startsWith("--")
  ? process.argv[3]
  : "ต่างประเทศ";

async function main() {
  const parents = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(
      or(eq(categories.slug, PARENT_QUERY), eq(categories.name, PARENT_QUERY))
    );

  console.log(`parent candidates for "${PARENT_QUERY}":`);
  for (const p of parents) console.log(`  ${p.id} | ${p.slug} | ${p.name}`);

  const parent = parents[0];
  if (!parent) {
    console.error(`no parent matching "${PARENT_QUERY}" — aborting`);
    process.exit(1);
  }
  console.log(`chosen parent: ${parent.id} (${parent.name}, slug=${parent.slug})`);

  // Find candidates by slug/name containing keyword, excluding the parent itself
  const cands = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(
      and(
        or(
          like(categories.slug, `%${KEYWORD}%`),
          like(categories.name, `%${KEYWORD}%`)
        ),
        ne(categories.id, parent.id)
      )
    );

  console.log(`\nmatches for "${KEYWORD}": ${cands.length}`);
  const needsMove = cands.filter((c) => c.parentId !== parent.id);
  const already = cands.length - needsMove.length;
  console.log(`already under parent: ${already}`);
  console.log(`will move: ${needsMove.length}`);
  console.log("first 20 to move:", needsMove.slice(0, 20).map((c) => c.slug).join(", "));

  if (!APPLY) {
    console.log("\n(dry-run — re-run with --apply to commit)");
    process.exit(0);
  }

  if (needsMove.length === 0) {
    console.log("nothing to do.");
    process.exit(0);
  }

  const ids = needsMove.map((c) => c.id);
  const updated = await db
    .update(categories)
    .set({ parentId: parent.id, updatedAt: new Date() })
    .where(inArray(categories.id, ids))
    .returning({ id: categories.id });

  console.log(`updated: ${updated.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
