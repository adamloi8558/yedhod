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
 * The complete set of category ids a tenant can show clips from. This is
 * the union of:
 *   - every tenant-picked category (leaf or parent)
 *   - every active descendant of each tenant-picked parent
 *   - every leaf sibling of a tenant-picked leaf (i.e. same parent)
 *
 * Rule intent: the tenant nav shows top-level parents, so any clip in ANY
 * descendant of those parents should be reachable. Picking a single leaf
 * still surfaces the whole parent bucket (matches user expectation).
 */
async function tenantEffectiveCategoryIds(tenantId: string): Promise<string[]> {
  const picked = await tenantCategoryIds(tenantId);
  if (picked.length === 0) return [];

  const pickedRows = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(inArray(categories.id, picked));

  const parentIds = new Set<string>();
  for (const r of pickedRows) {
    if (r.parentId) parentIds.add(r.parentId);
    else parentIds.add(r.id); // itself is a top-level parent
  }

  if (parentIds.size === 0) return picked;

  const descendants = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        inArray(categories.parentId, Array.from(parentIds)),
        eq(categories.isActive, true)
      )
    );

  const set = new Set<string>(picked);
  for (const p of parentIds) set.add(p);
  for (const d of descendants) set.add(d.id);
  return Array.from(set);
}

/**
 * Given a category id from the nav (which is a parent), return every clip's
 * bucket to look in.
 *
 * When the tenant has picked ANY descendant leaf under this parent, we
 * expand to ALL active member-level descendants — the tenant intent is
 * "show the whole parent bucket". This makes the nav dead-simple (parents
 * only) while surfacing content from every child the parent contains.
 *
 * If the parent is directly picked (rare, since leaves are what the admin
 * usually selects), we still fall back to all its descendants.
 */
async function resolveCategoryFilter(
  tenantId: string,
  categoryId: string
): Promise<string[]> {
  const tenantIds = await tenantCategoryIds(tenantId);
  if (tenantIds.length === 0) return [];

  // Fetch all active descendants of this categoryId
  const kids = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.parentId, categoryId), eq(categories.isActive, true)));

  const tenantSet = new Set(tenantIds);
  const anyDescendantPicked = kids.some((k) => tenantSet.has(k.id));
  const parentDirectlyPicked = tenantSet.has(categoryId);

  if (!anyDescendantPicked && !parentDirectlyPicked) return [];

  const scope = new Set<string>();
  if (parentDirectlyPicked) scope.add(categoryId);
  // Broaden: include ALL descendants (not just picked leaves) so parent
  // pages show the full bucket the parent represents.
  for (const k of kids) scope.add(k.id);
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
