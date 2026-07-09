import "dotenv/config";
import { db } from "../src/index";
import { categories, clips, telegramSyncMessages } from "../src/schema";
import { sql, inArray } from "drizzle-orm";

async function main() {
  const before = await db.select({ n: sql<number>`count(*)::int` }).from(categories);
  console.log(`categories before: ${before[0]?.n}`);

  // Find categories with zero clips (any status). Uses a NOT EXISTS to be
  // resilient even if a category has only inactive clips — those are treated
  // as still occupied. Confirmed via user: cascade delete acceptable.
  const empty = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM ${clips} WHERE ${clips.categoryId} = ${categories.id})`
    );

  console.log(`empty categories: ${empty.length}`);
  if (empty.length === 0) {
    console.log("nothing to delete.");
    process.exit(0);
  }

  console.log("first 20:", empty.slice(0, 20).map((c) => c.name).join(", "));

  const ids = empty.map((c) => c.id);
  // telegram_sync_messages has FK to categories without cascade; clear those first.
  const purgedMsgs = await db
    .delete(telegramSyncMessages)
    .where(inArray(telegramSyncMessages.categoryId, ids))
    .returning({ id: telegramSyncMessages.id });
  console.log(`purged telegram_sync_messages: ${purgedMsgs.length}`);

  const deleted = await db
    .delete(categories)
    .where(inArray(categories.id, ids))
    .returning({ id: categories.id });

  console.log(`deleted: ${deleted.length}`);

  const after = await db.select({ n: sql<number>`count(*)::int` }).from(categories);
  console.log(`categories after: ${after[0]?.n}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
