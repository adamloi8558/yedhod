import { db } from "@kodhom/db";
import { clips, categories, clipStats, clipReactions } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipPlayer } from "@/components/clip-player";
import { LikeButton } from "@/components/like-button";
import { Badge } from "@kodhom/ui/components/badge";
import { Crown, Clock, Calendar, Tag, Eye } from "lucide-react";
import { formatDuration, formatThaiDate } from "@kodhom/ui/lib/utils";
import { notFound } from "next/navigation";
import { hasActiveSubscription, hasCategoryAccess } from "@/lib/access-control";
import { Breadcrumb } from "@/components/breadcrumb";
import { ShareRow } from "@/components/share-row";
import { ClipCard } from "@/components/clip-card";
import { VideoObjectJsonLd } from "@/components/jsonld/video-object";
import {
  clipDisplayTitle,
  clipPageTitle,
  clipDescription,
  canonical,
  absoluteUrl,
} from "@/lib/seo/metadata";
import { getRelatedClips } from "@/lib/related-clips";
import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

async function loadClipAndCategory(id: string) {
  const [clip] = await db
    .select()
    .from(clips)
    .where(and(eq(clips.id, id), eq(clips.isActive, true)))
    .limit(1);
  if (!clip) return null;
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, clip.categoryId))
    .limit(1);
  if (!category) return null;
  return { clip, category };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadClipAndCategory(id);
  if (!data) return { title: "ไม่พบคลิป" };
  const { clip, category } = data;

  const title = clipPageTitle(clip, category);
  const description = clipDescription(clip, category);
  const path = `/clip/${clip.id}`;

  return {
    title,
    description,
    alternates: canonical(path),
    openGraph: {
      type: "video.other",
      url: path,
      title,
      description,
      videos: [{ url: absoluteUrl(path) }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ClipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadClipAndCategory(id);
  if (!data) notFound();
  const { clip, category } = data;

  const session = await getSession();
  let hasAccess = false;
  const isVip = category.accessLevel === "vip";
  let hasSub = false;
  let userRole = "member";

  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    if (userRole === "admin") {
      hasAccess = true;
    } else {
      hasSub = await hasActiveSubscription(session.user.id);
      hasAccess = hasCategoryAccess(userRole, category.accessLevel, hasSub);
    }
  }

  const displayTitle = clipDisplayTitle(clip, category);

  const [stats] = await db
    .select({
      viewCount: clipStats.viewCount,
      likeCount: clipStats.likeCount,
    })
    .from(clipStats)
    .where(eq(clipStats.clipId, clip.id))
    .limit(1);
  let userLiked = false;
  if (session?.user) {
    const [reaction] = await db
      .select({ clipId: clipReactions.clipId })
      .from(clipReactions)
      .where(
        and(
          eq(clipReactions.clipId, clip.id),
          eq(clipReactions.userId, session.user.id)
        )
      )
      .limit(1);
    userLiked = !!reaction;
  }
  const viewCount = stats?.viewCount ?? 0;
  const likeCount = stats?.likeCount ?? 0;

  const related = await getRelatedClips(category.id, clip.id, 8);

  const relatedWithAccess = related.map((c: typeof related[number]) => {
    const access = session?.user
      ? hasCategoryAccess(userRole, c.accessLevel, hasSub)
      : false;
    return { clip: c, hasAccess: access };
  });

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 animate-fade-in">
      <VideoObjectJsonLd clip={clip} category={category} />

      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: category.name, href: `/category/${category.slug}` },
          { name: displayTitle },
        ]}
      />

      {/* -------- 2-column layout on lg+ (video left, related right) -------- */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          {/* Player — cinematic frame with soft outer glow */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 md:-inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-vip/10 blur-2xl opacity-70"
            />
            <div className="relative -mx-4 md:mx-0 md:rounded-3xl overflow-hidden md:ring-1 md:ring-white/10 md:shadow-[0_25px_60px_-15px_oklch(0_0_0/0.8)] bg-black">
              <ClipPlayer
                clipId={clip.id}
                hasAccess={hasAccess}
                isVip={isVip}
                isLoggedIn={!!session?.user}
              />
            </div>
          </div>

          {/* Chips */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isVip && (
              <Badge variant="vip" className="gap-1 flex-shrink-0 animate-pulse-glow">
                <Crown className="h-3 w-3" />
                VIP
              </Badge>
            )}
            <Link
              href={`/category/${category.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-3 py-1 text-xs font-medium transition-smooth hover:bg-white/[0.08]"
            >
              <Tag className="h-3 w-3" />
              {category.name}
            </Link>
            {clip.duration && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] px-3 py-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(clip.duration)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] px-3 py-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatThaiDate(new Date(clip.createdAt))}
            </span>
            {viewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] px-3 py-1 text-xs text-muted-foreground tabular-nums">
                <Eye className="h-3 w-3" />
                {viewCount.toLocaleString("th-TH")} ครั้ง
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display mt-5 mb-6 text-3xl md:text-4xl font-black tracking-tight leading-[1.15] text-balance">
            {displayTitle}
          </h1>

          {/* Actions row */}
          <div className="mb-6">
            <LikeButton
              clipId={clip.id}
              initialLiked={userLiked}
              initialCount={likeCount}
              isLoggedIn={!!session?.user}
            />
          </div>
          <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
            <ShareRow url={absoluteUrl(`/clip/${clip.id}`)} title={displayTitle} />
            {!hasAccess && isVip && (
              <Link
                href={`/pricing?redirect=${encodeURIComponent(`/clip/${clip.id}`)}`}
                className="inline-flex items-center gap-3 rounded-xl border border-vip/40 bg-vip/5 p-3 pr-4 transition-smooth hover:bg-vip/10 glow-vip"
              >
                <Crown className="h-5 w-5 text-vip flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold">ดูเต็มด้วย VIP</div>
                  <div className="text-xs text-muted-foreground">สมัครสมาชิกเพื่อรับชม</div>
                </div>
              </Link>
            )}
          </div>

          {/* Description */}
          {clip.description && (
            <section aria-labelledby="clip-about-heading" className="mt-10 md:mt-14">
              <h2
                id="clip-about-heading"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 mb-3"
              >
                เกี่ยวกับคลิปนี้
              </h2>
              <article className="max-w-3xl text-sm md:text-base text-foreground/85 leading-relaxed whitespace-pre-wrap">
                {clip.description}
              </article>
            </section>
          )}
        </div>

        {/* -------- Related — right column on lg+, below player on mobile -------- */}
        {relatedWithAccess.length > 0 && (
          <aside aria-labelledby="related-heading" className="min-w-0">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  ต่อไป & แนะนำ
                </p>
                <h2 id="related-heading" className="font-display text-xl md:text-2xl font-black mt-0.5">
                  คลิปที่เกี่ยวข้อง
                </h2>
              </div>
              <Link
                href={`/category/${category.slug}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                ดูทั้งหมด →
              </Link>
            </div>

            {/* On lg+ this is a vertical stack of "list-tile" cards.
                On mobile / md the ClipCard grid gives 2-3 per row. */}
            <div className="lg:hidden grid grid-cols-2 md:grid-cols-3 gap-4">
              {relatedWithAccess.map(({ clip: c, hasAccess: ha }) => (
                <ClipCard
                  key={c.id}
                  clip={c}
                  categoryName={c.categoryName}
                  hasAccess={ha}
                  isLoggedIn={!!session?.user}
                />
              ))}
            </div>
            <div className="hidden lg:flex flex-col gap-3">
              {relatedWithAccess.map(({ clip: c, hasAccess: ha }) => (
                <RelatedListTile
                  key={c.id}
                  clip={c}
                  hasAccess={ha}
                  isLoggedIn={!!session?.user}
                />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// Compact horizontal tile used in the right rail on the player page.
function RelatedListTile({
  clip,
  hasAccess,
  isLoggedIn,
}: {
  clip: {
    id: string;
    title: string;
    description?: string | null;
    thumbnailR2Key?: string | null;
    duration?: number | null;
    accessLevel: "member" | "vip";
    categoryName?: string;
    createdAt: Date;
    viewCount?: number | null;
  };
  hasAccess: boolean;
  isLoggedIn: boolean;
}) {
  const targetHref = hasAccess
    ? `/clip/${clip.id}`
    : !isLoggedIn
      ? `/login?redirect=${encodeURIComponent(`/clip/${clip.id}`)}`
      : "/pricing";

  const displayTitle = clipDisplayTitle(clip, { name: clip.categoryName ?? "" });
  const durationText = clip.duration ? formatDuration(clip.duration) : null;
  const resolvedThumb = clip.thumbnailR2Key
    ? `/api/thumbnail/${clip.id}`
    : undefined;

  return (
    <Link
      href={targetHref}
      className="group relative flex gap-3 rounded-xl p-2 transition-smooth hover:bg-white/[0.04]"
    >
      <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden ring-1 ring-white/5 group-hover:ring-primary/40 transition-smooth bg-card">
        {resolvedThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedThumb}
            alt=""
            className="h-full w-full object-cover transition-smooth-lg group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full gradient-primary" />
        )}
        {durationText && (
          <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
            {durationText}
          </span>
        )}
        {clip.accessLevel === "vip" && (
          <span className="absolute top-1 left-1 inline-flex items-center rounded-full gradient-vip px-1.5 py-0.5 text-[9px] font-bold text-black/80">
            VIP
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <h4 className="line-clamp-2 text-sm font-semibold leading-tight group-hover:text-primary transition-smooth">
          {displayTitle}
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">
          {clip.categoryName}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {clip.viewCount != null && clip.viewCount > 0
            ? `${clip.viewCount.toLocaleString("th-TH")} ครั้ง`
            : formatThaiDate(new Date(clip.createdAt))}
        </p>
      </div>
    </Link>
  );
}
