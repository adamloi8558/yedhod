import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipPlayer } from "@/components/clip-player";
import { Badge } from "@kodhom/ui/components/badge";
import { Crown, Clock, Calendar, Tag } from "lucide-react";
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
import { getPresignedDownloadUrl } from "@kodhom/r2";
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
  const related = await getRelatedClips(category.id, clip.id, 8);

  const relatedWithAccess = await Promise.all(
    related.map(async (c: typeof related[number]) => {
      let thumbnailUrl: string | undefined;
      if (c.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(c.thumbnailR2Key, 3600);
        } catch {
          // ignore
        }
      }
      const access = session?.user
        ? hasCategoryAccess(userRole, c.accessLevel, hasSub)
        : false;
      return { clip: c, thumbnailUrl, hasAccess: access };
    })
  );

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      <VideoObjectJsonLd clip={clip} category={category} />

      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: category.name, href: `/category/${category.slug}` },
          { name: displayTitle },
        ]}
      />

      {/* Player */}
      <div className="-mx-4 md:mx-0 md:rounded-2xl overflow-hidden md:ring-1 md:ring-border/40 md:shadow-[0_8px_40px_-8px] md:shadow-black/50 bg-black">
        <ClipPlayer
          clipId={clip.id}
          hasAccess={hasAccess}
          isVip={isVip}
          isLoggedIn={!!session?.user}
        />
      </div>

      {/* Meta chips */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {isVip && (
          <Badge variant="vip" className="gap-1 flex-shrink-0 animate-pulse-glow">
            <Crown className="h-3 w-3" />
            VIP
          </Badge>
        )}
        <Link
          href={`/category/${category.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-border/30 px-3 py-1 text-xs font-medium transition-smooth hover:bg-muted"
        >
          <Tag className="h-3 w-3" />
          {category.name}
        </Link>
        {clip.duration && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/30 px-3 py-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDuration(clip.duration)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/30 border border-border/30 px-3 py-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatThaiDate(new Date(clip.createdAt))}
        </span>
      </div>

      {/* H1 — generated title */}
      <h1 className="mt-4 mb-5 text-2xl md:text-3xl font-bold tracking-tight leading-tight text-balance">
        {displayTitle}
      </h1>

      {/* Share row + VIP upgrade CTA */}
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
        <ShareRow
          url={absoluteUrl(`/clip/${clip.id}`)}
          title={displayTitle}
        />
        {!hasAccess && isVip && (
          <Link
            href="/pricing"
            className="inline-flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 pr-4 transition-smooth hover:bg-primary/10"
          >
            <Crown className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">ดูแบบเต็มด้วย VIP</div>
              <div className="text-xs text-muted-foreground">สมัครสมาชิกเพื่อรับชม</div>
            </div>
          </Link>
        )}
      </div>

      {/* Description */}
      {clip.description && (
        <section aria-labelledby="clip-about-heading" className="mt-10">
          <h2 id="clip-about-heading" className="text-lg md:text-xl font-semibold tracking-tight mb-3">
            เกี่ยวกับคลิปนี้
          </h2>
          <article className="max-w-3xl text-sm md:text-base text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {clip.description}
          </article>
        </section>
      )}

      {/* Divider */}
      <div className="my-10 md:my-14 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Related clips */}
      {relatedWithAccess.length > 0 && (
        <section aria-labelledby="related-heading">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 id="related-heading" className="text-lg md:text-xl font-semibold tracking-tight">
                คลิปที่เกี่ยวข้อง
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ในหมวด {category.name}
              </p>
            </div>
            <Link
              href={`/category/${category.slug}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {relatedWithAccess.map(({ clip: c, thumbnailUrl, hasAccess: ha }: typeof relatedWithAccess[number]) => (
              <ClipCard
                key={c.id}
                clip={c}
                categoryName={c.categoryName}
                thumbnailUrl={thumbnailUrl}
                hasAccess={ha}
                isLoggedIn={!!session?.user}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
