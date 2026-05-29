export interface GroupableCategory {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  parentId: string | null;
  isPinned: boolean;
}

export interface CategorySection<T extends GroupableCategory> {
  parent: T | null;
  title: string;
  children: T[];
}

/**
 * Group a flat category list by parent into sections.
 * - A top-level category (parentId null) that has children becomes a section.
 * - Top-level categories with no children — and orphans whose parent is
 *   missing/inactive — fall into a trailing "อื่นๆ" section.
 */
export function groupCategories<T extends GroupableCategory>(
  cats: T[]
): CategorySection<T>[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const childrenByParent = new Map<string, T[]>();

  for (const c of cats) {
    if (!c.parentId || !byId.has(c.parentId)) continue;
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentId, arr);
  }

  const sections: CategorySection<T>[] = [];
  const usedIds = new Set<string>();

  for (const c of cats) {
    if (c.parentId) continue; // not top-level
    const children = childrenByParent.get(c.id) ?? [];
    if (children.length > 0) {
      sections.push({ parent: c, title: c.name, children: sortCats(children) });
      usedIds.add(c.id);
      children.forEach((ch) => usedIds.add(ch.id));
    }
  }

  // Everything not placed in a section yet → "อื่นๆ"
  const leftovers = cats.filter((c) => !usedIds.has(c.id));
  if (leftovers.length > 0) {
    sections.push({ parent: null, title: "อื่นๆ", children: sortCats(leftovers) });
  }

  return sections;
}

function sortCats<T extends GroupableCategory>(cats: T[]): T[] {
  return [...cats].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.name.localeCompare(b.name, "th");
  });
}
