import { db } from "@kodhom/db";
import { categories, clips } from "@kodhom/db/schema";
import { and, eq, desc, count, isNotNull, asc } from "drizzle-orm";
import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryCard } from "@/components/category-card";
import { groupCategories } from "@/lib/group-categories";
import { pageTitle, canonical } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  const title = pageTitle("หมวดหมู่ทั้งหมด");
  return {
    title,
    description: "เลือกดูคลิปวิดีโอตามหมวดหมู่ จัดกลุ่มให้ค้นหาง่าย",
    alternates: canonical("/categories"),
  };
}

export default async function CategoriesPage() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      parentId: categories.parentId,
      isPinned: categories.isPinned,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(desc(categories.isPinned), asc(categories.sortOrder), asc(categories.name));

  // Clip count per category (active clips only).
  const counts = await db
    .select({ categoryId: clips.categoryId, n: count() })
    .from(clips)
    .where(eq(clips.isActive, true))
    .groupBy(clips.categoryId);
  const countByCat = new Map(counts.map((c) => [c.categoryId, c.n]));

  // Representative thumbnail per category = newest active clip with a thumb.
  const thumbRows = await db
    .selectDistinctOn([clips.categoryId], {
      categoryId: clips.categoryId,
      clipId: clips.id,
      thumbnailR2Key: clips.thumbnailR2Key,
    })
    .from(clips)
    .where(and(eq(clips.isActive, true), isNotNull(clips.thumbnailR2Key)))
    .orderBy(clips.categoryId, desc(clips.createdAt));
  const thumbByCat = new Map(
    thumbRows.map((t) => [t.categoryId, `/api/thumbnail/${t.clipId}`])
  );

  const sections = groupCategories(rows);

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
          เลือกดูคลิปตามหมวดหมู่ที่คุณสนใจ จัดกลุ่มไว้ให้ค้นหาง่ายขึ้น
        </p>
      </section>

      {sections.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</p>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.parent?.id ?? "general"} className="animate-slide-up">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="h-6 w-1 rounded-full gradient-primary" />
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight">
                    {section.title}
                  </h2>
                </div>
                <span className="rounded-full bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
                  {section.children.length} หมวด
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
                {section.children.map((cat) => (
                  <CategoryCard
                    key={cat.id}
                    category={{
                      ...cat,
                      thumbnailUrl: cat.coverImage ? null : thumbByCat.get(cat.id) ?? null,
                      clipCount: countByCat.get(cat.id) ?? 0,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
