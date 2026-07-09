import { db } from "@kodhom/db";
import {
  categories,
  clips,
  tenantAds,
  tenantCategories,
} from "@kodhom/db/schema";
import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";

export async function getTenantCategories(tenantId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      sortOrder: tenantCategories.sortOrder,
    })
    .from(tenantCategories)
    .innerJoin(categories, eq(categories.id, tenantCategories.categoryId))
    .where(
      and(
        eq(tenantCategories.tenantId, tenantId),
        eq(categories.isActive, true)
      )
    )
    .orderBy(asc(tenantCategories.sortOrder), asc(categories.name));
}

async function tenantCategoryIds(tenantId: string) {
  const rows = await db
    .select({ categoryId: tenantCategories.categoryId })
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, tenantId));
  return rows.map((r) => r.categoryId);
}

export async function getTenantClips(
  tenantId: string,
  opts: { categoryId?: string; limit?: number; offset?: number } = {}
) {
  const catIds = await tenantCategoryIds(tenantId);
  if (catIds.length === 0) return [];
  const idFilter: SQL = opts.categoryId
    ? eq(clips.categoryId, opts.categoryId)
    : inArray(clips.categoryId, catIds);
  const rows = await db
    .select({
      id: clips.id,
      title: clips.title,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      categoryId: clips.categoryId,
    })
    .from(clips)
    .where(
      and(
        eq(clips.isActive, true),
        eq(clips.accessLevel, "member"),
        idFilter
      )
    )
    .orderBy(desc(clips.createdAt))
    .limit(opts.limit ?? 60)
    .offset(opts.offset ?? 0);
  return rows;
}

export async function getTenantClipInScope(tenantId: string, clipId: string) {
  const catIds = await tenantCategoryIds(tenantId);
  if (catIds.length === 0) return null;
  const [row] = await db
    .select()
    .from(clips)
    .where(
      and(
        eq(clips.id, clipId),
        eq(clips.isActive, true),
        eq(clips.accessLevel, "member"),
        inArray(clips.categoryId, catIds)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getTenantAds(tenantId: string, slot?: string) {
  const filters = [
    eq(tenantAds.tenantId, tenantId),
    eq(tenantAds.isActive, true),
  ];
  if (slot) filters.push(eq(tenantAds.slot, slot as never));
  return db
    .select()
    .from(tenantAds)
    .where(and(...filters))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));
}
