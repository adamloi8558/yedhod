import Link from "next/link";
import { db } from "@kodhom/db";
import { clips, categories, clipStats, watchProgress } from "@kodhom/db/schema";
import { eq, desc, and, count, gt, isNull, isNotNull, lt } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { FeaturedHero } from "@/components/featured-hero";
import { hasActiveSubscription, hasCategoryAccess } from "@/lib/access-control";
import { WebsiteJsonLd } from "@/components/jsonld/website";
import { BRAND, canonical } from "@/lib/seo/metadata";
import { Crown, ArrowRight, PlayCircle, Flame, TrendingUp } from "lucide-react";
import { gradientThumbStyle } from "@/lib/gradient-thumb";
import type { Metadata } from "next";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return {
    title: `${BRAND} - คลิปวิดีโอผู้ใหญ่ไทย ดูฟรี ดูได้ทุกที่`,
    description: `${BRAND} รวมคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง อัปเดตใหม่ทุกวัน ดูได้ทุกที่ทุกเวลา สมาชิก VIP ดูไม่จำกัด สำหรับผู้มีอายุ 18 ปีขึ้นไป`,
    alternates: canonical("/"),
    openGraph: {
      type: "website",
      url: "/",
      title: `${BRAND} - คลิปวิดีโอผู้ใหญ่ไทย`,
    },
  };
}

export default async function HomePage() {
  const session = await getSession();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const clipSelect = {
    id: clips.id,
    title: clips.title,
    description: clips.description,
    thumbnailR2Key: clips.thumbnailR2Key,
    duration: clips.duration,
    accessLevel: categories.accessLevel,
    categoryId: clips.categoryId,
    categoryName: categories.name,
    categorySlug: categories.slug,
    createdAt: clips.createdAt,
    viewCount: clipStats.viewCount,
    likeCount: clipStats.likeCount,
  };

  const [allClips, trending, topTen, popularCategories, categoryChildCounts] = await Promise.all([
    // Latest feed
    db
      .select(clipSelect)
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .leftJoin(clipStats, eq(clipStats.clipId, clips.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true)))
      .orderBy(desc(clips.createdAt))
      .limit(18),
    // Trending — recent view bucket. First 3 fuel the hero carousel.
    db
      .select(clipSelect)
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .innerJoin(clipStats, eq(clipStats.clipId, clips.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true)))
      .orderBy(desc(clipStats.recentViews), desc(clipStats.viewCount))
      .limit(12),
    // Top 10 this week — clips created in the last 7d, ranked by total views.
    // We accept "created in last 7d" as a proxy for "of the week" — matches
    // how the concept mock reads even if the ranking data itself is lifetime.
    db
      .select(clipSelect)
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .innerJoin(clipStats, eq(clipStats.clipId, clips.id))
      .where(
        and(
          eq(clips.isActive, true),
          eq(categories.isActive, true),
          gt(clips.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(clipStats.viewCount), desc(clipStats.recentViews))
      .limit(10),
    // Popular parents for the tab-pill row
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        accessLevel: categories.accessLevel,
      })
      .from(categories)
      .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
      .orderBy(desc(categories.isPinned), categories.sortOrder)
      .limit(8),
    // Child count per parent category — used to route tiles:
    // parent with children → /categories/<slug>; leaf → /category/<slug>.
    db
      .select({ parentId: categories.parentId, n: count() })
      .from(categories)
      .where(and(eq(categories.isActive, true), isNotNull(categories.parentId)))
      .groupBy(categories.parentId),
  ]);

  const childCountByParent = new Map(
    categoryChildCounts.map((r) => [r.parentId as string, r.n])
  );
  const categoryHref = (cat: { id: string; slug: string }) =>
    (childCountByParent.get(cat.id) ?? 0) > 0
      ? `/categories/${cat.slug}`
      : `/category/${cat.slug}`;

  let hasSub = false;
  let userRole = "member";
  let continueWatching: typeof allClips = [];
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    hasSub = await hasActiveSubscription(session.user.id);
    continueWatching = await db
      .select(clipSelect)
      .from(watchProgress)
      .innerJoin(clips, eq(clips.id, watchProgress.clipId))
      .innerJoin(categories, eq(categories.id, clips.categoryId))
      .leftJoin(clipStats, eq(clipStats.clipId, clips.id))
      .where(
        and(
          eq(watchProgress.userId, session.user.id),
          eq(clips.isActive, true),
          eq(categories.isActive, true),
          gt(watchProgress.positionSec, 5),
          lt(watchProgress.positionSec, 99999)
        )
      )
      .orderBy(desc(watchProgress.updatedAt))
      .limit(8);
  }

  const decorateAccess = <T extends { accessLevel: "member" | "vip" }>(items: T[]) =>
    items.map((clip) => {
      const access = session?.user
        ? hasCategoryAccess(userRole, clip.accessLevel, hasSub)
        : false;
      return { clip, hasAccess: access };
    });

  const isLoggedIn = !!session?.user;

  // Fuel the hero from the top-3 trending clips. Falls back to latest.
  const heroClips = (trending.length >= 3 ? trending : allClips).slice(0, 5);
  // Trending row excludes the ones we already used up top.
  const trendingRow = trending.slice(0, 8);
  const clipsWithAccess = decorateAccess(allClips);
  const trendingWithAccess = decorateAccess(trendingRow);
  const topTenWithAccess = decorateAccess(topTen).slice(0, 10);
  const continueWatchingWithAccess = decorateAccess(continueWatching);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 animate-fade-in">
      <WebsiteJsonLd />

      {/* -------- Cinematic hero carousel -------- */}
      {heroClips.length > 0 && (
        <div className="mb-10 md:mb-14">
          <FeaturedHero clips={heroClips} isLoggedIn={isLoggedIn} />
        </div>
      )}

      {/* -------- Category tab-pills — Synctoon-style horizontal scroll -------- */}
      {popularCategories.length > 0 && (
        <div className="mb-10 md:mb-12">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            <Link href="/clips" className="pill pill-active">
              ทั้งหมด
            </Link>
            {popularCategories.map((cat) => (
              <Link key={cat.id} href={categoryHref(cat)} className="pill">
                {cat.accessLevel === "vip" && <Crown className="h-3 w-3 text-vip" />}
                {cat.name}
              </Link>
            ))}
            <Link href="/categories" className="pill">
              ดูทั้งหมด →
            </Link>
          </div>
        </div>
      )}

      {/* -------- Continue watching -------- */}
      {continueWatchingWithAccess.length > 0 && (
        <section aria-labelledby="continue-heading" className="mb-14">
          <SectionHeader
            icon={<PlayCircle className="h-5 w-5 text-primary" />}
            id="continue-heading"
            title="ดูต่อจากที่ค้างไว้"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {continueWatchingWithAccess.map(({ clip, hasAccess }) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                hasAccess={hasAccess}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </section>
      )}

      {/* -------- Top 10 this week — Netflix-style ranked poster row -------- */}
      {topTenWithAccess.length >= 3 && (
        <section aria-labelledby="top10-heading" className="mb-14">
          <SectionHeader
            icon={
              <span className="inline-flex items-center gap-1.5 text-lg">
                <span aria-hidden>🔥</span>
              </span>
            }
            id="top10-heading"
            title={<><span className="font-display italic">ท็อป 10</span> สัปดาห์นี้</>}
            right={
              <Link
                href="/clips?sort=view_count"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-smooth inline-flex items-center gap-1"
              >
                ดูทั้งหมด <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
            {topTenWithAccess.map(({ clip, hasAccess }, idx) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                hasAccess={hasAccess}
                isLoggedIn={isLoggedIn}
                rank={idx + 1}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* -------- Trending row -------- */}
      {trendingWithAccess.length > 0 && (
        <section aria-labelledby="trending-heading" className="mb-14">
          <SectionHeader
            icon={<Flame className="h-5 w-5 text-orange-400" fill="currentColor" />}
            id="trending-heading"
            title="คลิปมาแรง"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {trendingWithAccess.map(({ clip, hasAccess }) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                hasAccess={hasAccess}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </section>
      )}

      {/* -------- Popular categories — gradient tiles -------- */}
      {popularCategories.length > 0 && (
        <section aria-labelledby="cats-heading" className="mb-14">
          <SectionHeader
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            id="cats-heading"
            title="หมวดยอดนิยม"
            right={
              <Link
                href="/categories"
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-smooth inline-flex items-center gap-1"
              >
                ดูทั้งหมด <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {popularCategories.slice(0, 8).map((cat, idx) => (
              <Link
                key={cat.id}
                href={categoryHref(cat)}
                className="group relative overflow-hidden rounded-2xl aspect-[5/3] transition-smooth-lg hover:-translate-y-1"
              >
                <div
                  className="gradient-thumb absolute inset-0"
                  style={gradientThumbStyle(cat.id + idx)}
                />
                <div className="absolute inset-0 scrim-bottom opacity-90" />
                <div className="absolute inset-0 flex items-end p-5 md:p-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
                      หมวด
                    </p>
                    <h3 className="font-display text-2xl md:text-3xl font-black text-white leading-tight group-hover:text-primary transition-smooth">
                      {cat.name}
                    </h3>
                  </div>
                </div>
                {cat.accessLevel === "vip" && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full gradient-vip px-2.5 py-0.5 text-[10px] font-bold text-black/80 shadow">
                    <Crown className="h-3 w-3" fill="currentColor" /> VIP
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* -------- Latest -------- */}
      <section aria-labelledby="latest-heading" className="mb-14">
        <SectionHeader
          icon={<span aria-hidden className="h-5 w-1 rounded-full gradient-primary" />}
          id="latest-heading"
          title="คลิปอัปเดตล่าสุด"
          right={
            <Link
              href="/clips"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        {clipsWithAccess.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-slide-up">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <span className="text-3xl opacity-40">🎬</span>
            </div>
            <p className="text-muted-foreground font-medium">ยังไม่มีคลิป</p>
            <p className="text-sm text-muted-foreground/60 mt-1">คลิปใหม่กำลังจะมาเร็วๆ นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {clipsWithAccess.map(({ clip, hasAccess }) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                hasAccess={hasAccess}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  icon,
  id,
  title,
  right,
}: {
  icon: React.ReactNode;
  id: string;
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 id={id} className="text-lg md:text-2xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}
