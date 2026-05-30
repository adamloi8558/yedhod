import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { categories, clips } from "@kodhom/db/schema";
import { and, eq, desc, count, isNotNull, asc } from "drizzle-orm";
import { Breadcrumb } from "@/components/breadcrumb";
import { CategoryCard } from "@/components/category-card";
import { pageTitle, canonical } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [parent] = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  const name = parent?.name ?? "หมวดหมู่";
  return {
    title: pageTitle(`${name} — หมวดย่อย`),
    description: `หมวดย่อยของ ${name}`,
    alternates: canonical(`/categories/${slug}`),
  };
}

export default async function CategoryGroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [parent] = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  if (!parent) notFound();

  const children = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      isPinned: categories.isPinned,
    })
    .from(categories)
    .where(and(eq(categories.parentId, parent.id), eq(categories.isActive, true)))
    .orderBy(desc(categories.isPinned), asc(categories.sortOrder), asc(categories.name));

  // clip count per child
  const counts = await db
    .select({ categoryId: clips.categoryId, n: count() })
    .from(clips)
    .where(eq(clips.isActive, true))
    .groupBy(clips.categoryId);
  const countByCat = new Map(counts.map((c) => [c.categoryId, c.n]));

  // representative thumbnail per child
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

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "หมวดหมู่ทั้งหมด", href: "/categories" },
          { name: parent.name },
        ]}
      />

      <section className="relative mb-8 overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/15 via-accent/40 to-background p-6 md:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <h1 className="relative text-2xl md:text-4xl font-bold gradient-text tracking-tight">
          {parent.name}
        </h1>
        <p className="relative mt-3 max-w-xl text-sm md:text-base text-muted-foreground">
          เลือกหมวดย่อยที่คุณสนใจ
        </p>
      </section>

      {children.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          ยังไม่มีหมวดย่อย
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
          {children.map((cat) => (
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
      )}
    </div>
  );
}
