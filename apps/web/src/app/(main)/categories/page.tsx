import { db } from "@kodhom/db";
import { categories, clips } from "@kodhom/db/schema";
import { and, eq, desc, count, isNotNull, isNull, asc, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryCard } from "@/components/category-card";
import { pageTitle, canonical } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  const title = pageTitle("หมวดหมู่ทั้งหมด");
  return {
    title,
    description: "เลือกดูคลิปวิดีโอตามหมวดหลัก",
    alternates: canonical("/categories"),
  };
}

export default async function CategoriesPage() {
  // Top-level categories only. Each card links to /categories/[slug] which
  // shows its children. Top-level categories with no children link straight
  // to /category/[slug] (the clip feed) instead.
  const parents = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      isPinned: categories.isPinned,
    })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(desc(categories.isPinned), asc(categories.sortOrder), asc(categories.name));

  // child-count per parent (active only)
  const childCounts = await db
    .select({ parentId: categories.parentId, n: count() })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNotNull(categories.parentId)))
    .groupBy(categories.parentId);
  const childByParent = new Map(
    childCounts.map((r) => [r.parentId as string, r.n])
  );

  // Representative thumbnail per top-level category. Most clips live under
  // child categories, so we join via an alias `clipCategory` that matches
  // either the parent itself OR any of its direct children.
  const clipCategory = alias(categories, "clip_category");
  const thumbRows = await db
    .selectDistinctOn([categories.id], {
      parentCatId: categories.id,
      clipId: clips.id,
      thumbnailR2Key: clips.thumbnailR2Key,
    })
    .from(categories)
    .innerJoin(
      clipCategory,
      and(
        eq(clipCategory.isActive, true),
        or(
          eq(clipCategory.id, categories.id),
          eq(clipCategory.parentId, categories.id)
        )
      )
    )
    .innerJoin(
      clips,
      and(
        eq(clips.categoryId, clipCategory.id),
        eq(clips.isActive, true),
        isNotNull(clips.thumbnailR2Key)
      )
    )
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(categories.id, desc(clips.createdAt));
  const thumbByParent = new Map(
    thumbRows.map((t) => [t.parentCatId, `/api/thumbnail/${t.clipId}`])
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <Breadcrumb
        items={[{ name: "หน้าแรก", href: "/" }, { name: "หมวดหมู่ทั้งหมด" }]}
      />

      <section className="relative mb-8 overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/15 via-accent/40 to-background p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <h1 className="relative text-2xl md:text-4xl font-bold gradient-text tracking-tight">
          หมวดหมู่ทั้งหมด
        </h1>
        <p className="relative mt-3 max-w-xl text-sm md:text-base text-muted-foreground">
          เลือกหมวดหลักเพื่อดูหมวดย่อยและคลิปข้างใน
        </p>
      </section>

      {parents.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีหมวดหมู่หลัก</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {parents.map((cat) => {
            const childCount = childByParent.get(cat.id) ?? 0;
            // If parent has children → link to /categories/<slug>; else go straight to /category/<slug>
            return (
              <CategoryCard
                key={cat.id}
                category={{
                  ...cat,
                  thumbnailUrl: cat.coverImage ? null : thumbByParent.get(cat.id) ?? null,
                  clipCount: childCount > 0 ? childCount : undefined,
                }}
                href={
                  childCount > 0
                    ? `/categories/${cat.slug}`
                    : `/category/${cat.slug}`
                }
                countLabel={childCount > 0 ? "หมวดย่อย" : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
