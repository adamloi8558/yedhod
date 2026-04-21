import { cache } from "react";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { and, eq, desc, asc, count } from "drizzle-orm";

export const getActiveClipCount = cache(async () => {
  const [row] = await db
    .select({ c: count() })
    .from(clips)
    .innerJoin(categories, eq(clips.categoryId, categories.id))
    .where(and(eq(clips.isActive, true), eq(categories.isActive, true)));
  return Number(row?.c ?? 0);
});

export const getSitemapClips = cache(
  async (offset: number, limit: number) => {
    return db
      .select({
        id: clips.id,
        updatedAt: clips.updatedAt,
      })
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true)))
      .orderBy(desc(clips.createdAt), asc(clips.id))
      .limit(limit)
      .offset(offset);
  }
);

export const getSitemapCategories = cache(async () => {
  return db
    .select({
      slug: categories.slug,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));
});
