import { Suspense } from "react";
import Link from "next/link";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, desc, and, count as sqlCount } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import {
  hasActiveSubscriptionReadOnly,
  hasCategoryAccess,
} from "@/lib/access-control";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { CollectionPageJsonLd } from "@/components/jsonld/collection-page";
import {
  categoryTitle,
  categoryDescription,
  canonical,
} from "@/lib/seo/metadata";
import type { Metadata } from "next";
import { Crown } from "lucide-react";
import { getPresignedDownloadUrl } from "@kodhom/r2";

export const revalidate = 600;

const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);
  if (!category) return { title: "ไม่พบหมวด" };

  const [countRow] = await db
    .select({ c: sqlCount() })
    .from(clips)
    .where(and(eq(clips.categoryId, category.id), eq(clips.isActive, true)));
  const clipCount = Number(countRow?.c ?? 0);

  const path = `/category/${category.slug}`;
  const title = categoryTitle(category.name);
  const description = categoryDescription(category, clipCount);

  return {
    title,
    description,
    alternates: canonical(path),
    openGraph: {
      type: "website",
      url: path,
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, { page: pageParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  if (!category) notFound();

  const [session, countRow] = await Promise.all([
    getSession(),
    db
      .select({ c: sqlCount() })
      .from(clips)
      .where(and(eq(clips.categoryId, category.id), eq(clips.isActive, true)))
      .then(([row]) => row),
  ]);

  const totalClips = Number(countRow?.c ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalClips / PAGE_SIZE));
  const boundedPage = Math.min(currentPage, totalPages);
  const hasSubscriptionPromise = session?.user
    ? hasActiveSubscriptionReadOnly(session.user.id)
    : Promise.resolve(false);

  const isVip = category.accessLevel === "vip";
  const descriptionText = categoryDescription(category, totalClips);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: category.name },
        ]}
      />

      <section className="relative overflow-hidden mb-8 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-accent/50 to-transparent p-6 md:p-10">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
          หมวดหมู่
        </div>
        <h1 className="mt-2 flex items-center gap-3 text-2xl md:text-4xl font-bold tracking-tight">
          {category.name}
          {isVip && <Crown className="h-6 w-6 text-amber-400 shrink-0" />}
          <Suspense fallback={null}>
            <CategorySubscriptionBadge
              hasSubscriptionPromise={hasSubscriptionPromise}
            />
          </Suspense>
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-muted/50 border border-border/30 px-3 py-1 font-medium">
            {totalClips.toLocaleString("th-TH")} คลิป
          </span>
          {isVip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 font-medium text-amber-400">
              <Crown className="h-3 w-3" />
              สำหรับสมาชิก VIP
            </span>
          )}
        </div>
        <p className="mt-5 max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">
          {descriptionText}
        </p>
      </section>

      <Suspense fallback={<CategoryGridSkeleton />}>
        <CategoryClipGrid
          category={category}
          categoryId={category.id}
          session={session}
          hasSubscriptionPromise={hasSubscriptionPromise}
          currentPage={boundedPage}
          totalPages={totalPages}
          totalClips={totalClips}
        />
      </Suspense>
    </div>
  );
}

async function CategorySubscriptionBadge({
  hasSubscriptionPromise,
}: {
  hasSubscriptionPromise: Promise<boolean>;
}) {
  const hasSubscription = await hasSubscriptionPromise;
  if (!hasSubscription) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400 border border-green-500/20">
      สมัครแล้ว
    </span>
  );
}

async function CategoryClipGrid({
  category,
  categoryId,
  session,
  hasSubscriptionPromise,
  currentPage,
  totalPages,
  totalClips,
}: {
  category: {
    name: string;
    slug: string;
    description?: string | null;
  };
  categoryId: string;
  session: Awaited<ReturnType<typeof getSession>>;
  hasSubscriptionPromise: Promise<boolean>;
  currentPage: number;
  totalPages: number;
  totalClips: number;
}) {
  const offset = (currentPage - 1) * PAGE_SIZE;
  const [categoryClips, hasSubscription] = await Promise.all([
    db
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
      .where(and(eq(clips.categoryId, categoryId), eq(clips.isActive, true)))
      .orderBy(desc(clips.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    hasSubscriptionPromise,
  ]);

  const userRole = session?.user
    ? ((session.user as Record<string, unknown>).role as string) ?? "member"
    : "member";

  const clipsWithAccess = await Promise.all(
    categoryClips.map(async (clip: (typeof categoryClips)[number]) => {
      let thumbnailUrl: string | undefined;
      if (clip.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(
            clip.thumbnailR2Key,
            3600
          );
        } catch {
          // Fall back to the cached thumbnail API route.
        }
      }

      const access = session?.user
        ? hasCategoryAccess(userRole, clip.accessLevel, hasSubscription)
        : false;
      return { clip, thumbnailUrl, hasAccess: access };
    })
  );

  if (clipsWithAccess.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center animate-slide-up">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
          <span className="text-3xl opacity-40">ไม่มี</span>
        </div>
        <p className="text-muted-foreground font-medium">
          ยังไม่มีคลิปในหมวดหมู่นี้
        </p>
      </div>
    );
  }

  return (
    <>
      <CollectionPageJsonLd
        category={category}
        clipCount={totalClips}
        clips={categoryClips}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
        {clipsWithAccess.map(
          ({ clip, thumbnailUrl, hasAccess }: (typeof clipsWithAccess)[number]) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              categoryName={clip.categoryName}
              thumbnailUrl={thumbnailUrl}
              hasAccess={hasAccess}
              isLoggedIn={!!session?.user}
            />
          )
        )}
      </div>
      {totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {currentPage > 1 && (
            <Link
              href={`?page=${currentPage - 1}`}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium transition-smooth hover:bg-card"
            >
              ก่อนหน้า
            </Link>
          )}
          <span className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {currentPage.toLocaleString("th-TH")} /{" "}
            {totalPages.toLocaleString("th-TH")}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`?page=${currentPage + 1}`}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium transition-smooth hover:bg-card"
            >
              ถัดไป
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: PAGE_SIZE }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-card/60">
          <div className="aspect-video animate-pulse bg-muted" />
          <div className="space-y-2 p-3 md:p-3.5">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
