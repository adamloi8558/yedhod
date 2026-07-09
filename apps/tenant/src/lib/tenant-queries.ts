import { db } from "@kodhom/db";
import {
  categories,
  clips,
  tenantAds,
  tenantCategories,
} from "@kodhom/db/schema";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import { alias } from "drizzle-orm/pg-core";

/**
 * Categories displayed in the tenant nav.
 *
 * We show TOP-LEVEL parent categories only. A parent shows up if it (or any
 * of its descendants) is present in tenant_categories. This lets the admin
 * pick fine-grained leaves in the backoffice while keeping the public nav
 * short and readable.
 */
export async function getTenantCategories(tenantId: string) {
  const parents = alias(categories, "parents");
  const leaves = alias(categories, "leaves");

  // Parents reachable through tenant_categories -> leaves.parentId
  const throughLeaves = await db
    .selectDistinct({
      id: parents.id,
      name: parents.name,
      slug: parents.slug,
      coverImage: parents.coverImage,
    })
    .from(tenantCategories)
    .innerJoin(leaves, eq(leaves.id, tenantCategories.categoryId))
    .innerJoin(parents, eq(parents.id, leaves.parentId))
    .where(
      and(
        eq(tenantCategories.tenantId, tenantId),
        eq(leaves.isActive, true),
        eq(parents.isActive, true)
      )
    );

  // Also include categories directly present in tenant_categories that are
  // themselves top-level (parentId IS NULL). This covers the case where the
  // admin picked a top-level bucket directly.
  const directTopLevel = await db
    .selectDistinct({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
    })
    .from(tenantCategories)
    .innerJoin(categories, eq(categories.id, tenantCategories.categoryId))
    .where(
      and(
        eq(tenantCategories.tenantId, tenantId),
        eq(categories.isActive, true),
        sql`${categories.parentId} IS NULL`
      )
    );

  const map = new Map<string, (typeof throughLeaves)[number]>();
  for (const r of throughLeaves) map.set(r.id, r);
  for (const r of directTopLevel) map.set(r.id, r);
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "th"));
}

async function tenantCategoryIds(tenantId: string) {
  const rows = await db
    .select({ categoryId: tenantCategories.categoryId })
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, tenantId));
  return rows.map((r) => r.categoryId);
}

/**
 * Given a category slug, return the set of category ids to filter clips by.
 * If it's a leaf, return [that id]. If it's a parent, return [parent] + all
 * descendant leaves — but only ids that are present in this tenant's picks.
 */
async function resolveCategoryFilter(
  tenantId: string,
  categoryId: string
): Promise<string[]> {
  const tenantIds = await tenantCategoryIds(tenantId);
  if (tenantIds.length === 0) return [];

  // If categoryId is itself in the tenant picks, include it
  const scope = new Set<string>();
  if (tenantIds.includes(categoryId)) scope.add(categoryId);

  // Add any tenant-picked leaves whose parentId == categoryId
  const kids = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.parentId, categoryId), eq(categories.isActive, true)));
  const tenantSet = new Set(tenantIds);
  for (const k of kids) if (tenantSet.has(k.id)) scope.add(k.id);

  return Array.from(scope);
}

export async function getTenantClips(
  tenantId: string,
  opts: { categoryId?: string; limit?: number; offset?: number } = {}
) {
  const catIds = await tenantCategoryIds(tenantId);
  if (catIds.length === 0) return [];

  // If a categoryId is given, expand it to include tenant-picked descendants
  // (so a parent category page shows clips from all its enabled leaves too).
  let idFilter: SQL;
  if (opts.categoryId) {
    const scope = await resolveCategoryFilter(tenantId, opts.categoryId);
    if (scope.length === 0) return [];
    idFilter = inArray(clips.categoryId, scope);
  } else {
    idFilter = inArray(clips.categoryId, catIds);
  }

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
