import "dotenv/config";
import { db } from "../src/index";
import { categories, clips } from "../src/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Sources of truth
  const [av] = await db.select().from(categories).where(eq(categories.slug, "av")).limit(1);
  const [avc] = await db.select().from(categories).where(eq(categories.slug, "avc")).limit(1);
  if (!av || !avc) {
    console.error("missing av or avc", { av: !!av, avc: !!avc });
    process.exit(1);
  }
  console.log(`AV  = ${av.id}  (name=${av.name})`);
  console.log(`AVC = ${avc.id} (name=${avc.name})`);

  // 1. re-parent AVC's children to AV
  const reparented = await db
    .update(categories)
    .set({ parentId: av.id, updatedAt: new Date() })
    .where(eq(categories.parentId, avc.id))
    .returning({ id: categories.id, slug: categories.slug });
  console.log(`re-parented children: ${reparented.length}`);

  // 2. re-assign clips directly on AVC to AV
  const movedClips = await db
    .update(clips)
    .set({ categoryId: av.id, updatedAt: new Date() })
    .where(eq(clips.categoryId, avc.id))
    .returning({ id: clips.id });
  console.log(`moved clips: ${movedClips.length}`);

  // 3. delete AVC itself (may be blocked by telegram_sync_messages FK)
  //    if so, null-out the FK first
  try {
    const del = await db
      .delete(categories)
      .where(eq(categories.id, avc.id))
      .returning({ id: categories.id });
    console.log(`deleted avc: ${del.length}`);
  } catch (e) {
    console.error("delete failed, retry after clearing telegram_sync_messages", e);
    // fallback via raw SQL
    await db.execute(
      `UPDATE telegram_sync_messages SET category_id = NULL WHERE category_id = '${avc.id}'`
    );
    const del = await db
      .delete(categories)
      .where(eq(categories.id, avc.id))
      .returning({ id: categories.id });
    console.log(`deleted avc (after null-out): ${del.length}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
