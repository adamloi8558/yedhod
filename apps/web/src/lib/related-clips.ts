import { cache } from "react";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { and, eq, desc, ne } from "drizzle-orm";

export const getRelatedClips = cache(
  async (categoryId: string, excludeId: string, limit = 8) => {
    return db
      .select({
        id: clips.id,
        title: clips.title,
        description: clips.description,
        thumbnailR2Key: clips.thumbnailR2Key,
        duration: clips.duration,
        accessLevel: categories.accessLevel,
        categoryId: clips.categoryId,
        categoryName: categories.name,
        createdAt: clips.createdAt,
      })
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .where(
        and(
          eq(clips.isActive, true),
          eq(categories.isActive, true),
          eq(clips.categoryId, categoryId),
          ne(clips.id, excludeId)
        )
      )
      .orderBy(desc(clips.createdAt))
      .limit(limit);
  }
);
