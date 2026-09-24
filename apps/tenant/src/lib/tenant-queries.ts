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
        eq(leaves.accessLevel, "member"),
        eq(parents.isActive, true),
        eq(parents.accessLevel, "member")
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
        eq(categories.accessLevel, "member"),
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
 * The authorization scope contains active member-level categories explicitly
 * picked for the tenant. An explicitly picked parent also grants its active
 * member-level children; picking one leaf never grants sibling categories.
 */
async function tenantEffectiveCategoryIds(tenantId: string): Promise<string[]> {
  const picked = await tenantCategoryIds(tenantId);
  if (picked.length === 0) return [];

  const pickedRows = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(
      and(
        inArray(categories.id, picked),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member")
      )
    );

  const parentIds = new Set<string>();
  for (const r of pickedRows) {
    if (!r.parentId) parentIds.add(r.id);
  }

  const set = new Set<string>(pickedRows.map((row) => row.id));
  if (parentIds.size === 0) return Array.from(set);

  const descendants = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        inArray(categories.parentId, Array.from(parentIds)),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member")
      )
    );

  for (const d of descendants) set.add(d.id);
  return Array.from(set);
}

/**
 * Resolve a nav category to the subset of buckets already authorized by the
 * tenant's effective scope. This must never broaden access to siblings.
 */
async function resolveCategoryFilter(
  tenantId: string,
  categoryId: string
): Promise<string[]> {
  const tenantIds = await tenantEffectiveCategoryIds(tenantId);
  if (tenantIds.length === 0) return [];

  // Fetch all active descendants of this categoryId
  const kids = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(
      and(
        eq(categories.parentId, categoryId),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member")
      )
    );

  const tenantSet = new Set(tenantIds);
  const scope = new Set<string>();
  if (tenantSet.has(categoryId)) scope.add(categoryId);
  for (const k of kids) if (tenantSet.has(k.id)) scope.add(k.id);
  return Array.from(scope);
}

export async function getTenantClips(
  tenantId: string,
  opts: { categoryId?: string; limit?: number; offset?: number } = {}
) {
  let idFilter: SQL;
  if (opts.categoryId) {
    const scope = await resolveCategoryFilter(tenantId, opts.categoryId);
    if (scope.length === 0) return [];
    idFilter = inArray(clips.categoryId, scope);
  } else {
    const effective = await tenantEffectiveCategoryIds(tenantId);
    if (effective.length === 0) return [];
    idFilter = inArray(clips.categoryId, effective);
  }

  const rows = await db
    .select({
      id: clips.id,
      title: clips.title,
      thumbnailR2Key: clips.thumbnailR2Key,
      duration: clips.duration,
      categoryId: clips.categoryId,
      createdAt: clips.createdAt,
      categoryName: categories.name,
    })
    .from(clips)
    .innerJoin(categories, eq(categories.id, clips.categoryId))
    .where(
      and(
        eq(clips.isActive, true),
        eq(clips.accessLevel, "member"),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member"),
        idFilter
      )
    )
    .orderBy(desc(clips.createdAt))
    .limit(opts.limit ?? 60)
    .offset(opts.offset ?? 0);
  return rows;
}

export async function countTenantClips(
  tenantId: string,
  opts: { categoryId?: string } = {}
): Promise<number> {
  let idFilter: SQL;
  if (opts.categoryId) {
    const scope = await resolveCategoryFilter(tenantId, opts.categoryId);
    if (scope.length === 0) return 0;
    idFilter = inArray(clips.categoryId, scope);
  } else {
    const effective = await tenantEffectiveCategoryIds(tenantId);
    if (effective.length === 0) return 0;
    idFilter = inArray(clips.categoryId, effective);
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clips)
    .innerJoin(categories, eq(categories.id, clips.categoryId))
    .where(
      and(
        eq(clips.isActive, true),
        eq(clips.accessLevel, "member"),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member"),
        idFilter
      )
    );
  return n;
}

export async function getTenantClipInScope(tenantId: string, clipId: string) {
  const catIds = await tenantEffectiveCategoryIds(tenantId);
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
