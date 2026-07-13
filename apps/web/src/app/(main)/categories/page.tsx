import Link from "next/link";
import { db } from "@kodhom/db";
import { categories, clips } from "@kodhom/db/schema";
import { and, eq, desc, count, isNotNull, isNull, asc, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Breadcrumb } from "@/components/breadcrumb";
import { pageTitle, canonical } from "@/lib/seo/metadata";
import { gradientThumbStyle } from "@/lib/gradient-thumb";
import { Crown, Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 600;

export function generateMetadata(): Metadata {
  const title = pageTitle("สำรวจหมวดหมู่");
  return {
    title,
    description: "เลือกดูคลิปวิดีโอตามหมวดหลัก — โรแมนซ์ แอ็กชัน แฟนตาซี และอีกมากมาย",
    alternates: canonical("/categories"),
  };
}

export default async function CategoriesPage() {
  const parents = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      coverImage: categories.coverImage,
      accessLevel: categories.accessLevel,
      isPinned: categories.isPinned,
    })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
    .orderBy(desc(categories.isPinned), asc(categories.sortOrder), asc(categories.name));

  const childCounts = await db
    .select({ parentId: categories.parentId, n: count() })
    .from(categories)
    .where(and(eq(categories.isActive, true), isNotNull(categories.parentId)))
    .groupBy(categories.parentId);
  const childByParent = new Map(
    childCounts.map((r) => [r.parentId as string, r.n])
  );

  // Representative thumbnail per top-level category.
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

  // Two zones on the page — pinned/popular first (bigger tiles), then rest.
  const pinned = parents.filter((p) => p.isPinned).slice(0, 4);
  const rest = parents.filter((p) => !pinned.includes(p));

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 animate-fade-in">
      <Breadcrumb
        items={[{ name: "หน้าแรก", href: "/" }, { name: "สำรวจ" }]}
      />

      {/* -------- Header (Synctoon-style headline + search bar) -------- */}
      <header className="mb-8 md:mb-10">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-6xl font-black tracking-tight text-balance">
              <span className="gradient-text">สำรวจ</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm md:text-base text-muted-foreground">
              เลือกหมวดหลักที่ใช่ — จากโรแมนซ์ถึงแอ็กชัน เนื้อหาไทยล้วน อัปเดตทุกวัน
            </p>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {parents.length.toLocaleString("th-TH")} หมวด
          </span>
        </div>

        {/* Search bar — actual /search redirect */}
        <form action="/search" method="GET" className="mt-6 relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            name="q"
            placeholder="ค้นหาคลิป, หมวด, ผู้แสดง…"
            className="w-full h-12 pl-11 pr-4 rounded-full bg-white/[0.04] border border-white/[0.06] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:bg-white/[0.06] focus:border-primary/40 transition-smooth"
          />
        </form>
      </header>

      {parents.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีหมวดหมู่หลัก</p>
      ) : (
        <>
          {/* -------- Popular / pinned -------- */}
          {pinned.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                หมวดยอดนิยม
              </h2>
              <div className="grid grid-cols-2 gap-4 md:gap-5">
                {pinned.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    cat={cat}
                    href={
                      (childByParent.get(cat.id) ?? 0) > 0
                        ? `/categories/${cat.slug}`
                        : `/category/${cat.slug}`
                    }
                    thumbnailUrl={cat.coverImage ?? thumbByParent.get(cat.id) ?? null}
                    aspect="tall"
                  />
                ))}
              </div>
            </section>
          )}

          {/* -------- All -------- */}
          <section>
            {pinned.length > 0 && (
              <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                หมวดทั้งหมด
              </h2>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {rest.map((cat) => (
                <CategoryTile
                  key={cat.id}
                  cat={cat}
                  href={
                    (childByParent.get(cat.id) ?? 0) > 0
                      ? `/categories/${cat.slug}`
                      : `/category/${cat.slug}`
                  }
                  thumbnailUrl={cat.coverImage ?? thumbByParent.get(cat.id) ?? null}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CategoryTile({
  cat,
  href,
  thumbnailUrl,
  aspect = "wide",
}: {
  cat: {
    id: string;
    name: string;
    accessLevel: "member" | "vip";
    isPinned?: boolean;
  };
  href: string;
  thumbnailUrl: string | null;
  aspect?: "wide" | "tall";
}) {
  return (
    <Link
      href={href}
      className={
        "group relative overflow-hidden rounded-2xl ring-1 ring-white/5 transition-smooth-lg hover:-translate-y-1 hover:ring-primary/40 hover:shadow-[0_20px_50px_-16px_oklch(0.55_0.24_20/0.5)] " +
        (aspect === "tall" ? "aspect-[3/4]" : "aspect-[5/4]")
      }
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-smooth-lg group-hover:scale-105"
        />
      ) : (
        <div
          className="gradient-thumb absolute inset-0"
          style={gradientThumbStyle(cat.id)}
        />
      )}
      <div className="absolute inset-0 scrim-bottom" />
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
          หมวด
        </p>
        <h3 className="font-display text-xl md:text-2xl lg:text-3xl font-black text-white leading-tight group-hover:text-primary transition-smooth">
          {cat.name}
        </h3>
      </div>

      {cat.accessLevel === "vip" && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full gradient-vip px-2.5 py-0.5 text-[10px] font-bold text-black/85 shadow">
          <Crown className="h-3 w-3" fill="currentColor" /> VIP
        </span>
      )}
    </Link>
  );
}
