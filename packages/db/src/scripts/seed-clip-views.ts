/**
 * One-shot script to seed `clip_stats.view_count` based on clip age.
 * Older clips get higher numbers so the catalogue doesn't look empty
 * on day one. Re-running won't double-count: we only insert rows that
 * don't already exist.
 *
 * Run with:
 *   npx tsx --env-file=../../.env packages/db/src/scripts/seed-clip-views.ts
 */
import { config } from "dotenv";

// Load env BEFORE any import that touches process.env.DATABASE_URL.
// (ESM hoists static imports above top-level code, so dynamic imports
// are how we keep this ordering correct.)
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });
config({ path: "../.env" });

async function main() {
  const { db } = await import("../index");
  const { clips, clipStats } = await import("../schema");

  function ageBasedViewCount(createdAt: Date): { view: number; recent: number } {
    const ageDays = Math.max(
      0,
      (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    );
    const ageFactor = Math.min(60, ageDays);
    const base = 500 + Math.round(ageFactor * 180);
    const jitter = Math.round(base * (Math.random() * 0.6 - 0.1));
    const view = Math.max(120, base + jitter);
    const recencyMul = ageDays < 7 ? 0.05 : ageDays < 30 ? 0.02 : 0.005;
    const recent = Math.max(5, Math.round(view * recencyMul * Math.random() * 2));
    return { view, recent };
  }

  console.log("Loading clips…");
  const allClips = await db
    .select({ id: clips.id, createdAt: clips.createdAt })
    .from(clips);

  const existing = await db
    .select({ clipId: clipStats.clipId })
    .from(clipStats);
  const existingIds = new Set(existing.map((r) => r.clipId));

  const toInsert = allClips.filter((c) => !existingIds.has(c.id));
  console.log(
    `Found ${allClips.length} clips, ${existingIds.size} already seeded — inserting ${toInsert.length}.`
  );

  const chunkSize = 500;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize).map((c) => {
      const { view, recent } = ageBasedViewCount(new Date(c.createdAt));
      return {
        clipId: c.id,
        viewCount: view,
        recentViews: recent,
        likeCount: 0,
      };
    });
    if (chunk.length === 0) break;
    await db
      .insert(clipStats)
      .values(chunk)
      .onConflictDoNothing({ target: clipStats.clipId });
    console.log(
      `  …seeded ${Math.min(i + chunkSize, toInsert.length)}/${toInsert.length}`
    );
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
