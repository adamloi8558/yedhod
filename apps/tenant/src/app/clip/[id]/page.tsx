import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { TenantShell } from "@/components/tenant-shell";
import { AdSlot } from "@/components/ad-slot";
import { ClipFeed } from "@/components/clip-feed";
import VideoPlayer from "@/components/video-player";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClipInScope, getTenantClips } from "@/lib/tenant-queries";
import { prettyTitle } from "@/lib/pretty-title";

export const dynamic = "force-dynamic";

async function loadContext(id: string) {
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip) return null;
  const [cat] = await db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, clip.categoryId))
    .limit(1);
  return { tenant, clip, cat };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ctx = await loadContext(id);
  if (!ctx) return { title: "ไม่พบคลิป" };
  const { tenant, clip, cat } = ctx;
  const title = prettyTitle({
    rawTitle: clip.title,
    categoryName: cat?.name ?? "",
    createdAt: clip.createdAt,
  });
  const fullTitle = `${title} | ${tenant.name}`;
  const description =
    clip.description?.slice(0, 160) ||
    `${title}${cat ? ` — หมวด${cat.name}` : ""} ดูคลิปฟรี HD ที่ ${tenant.name}`;
  const image = clip.thumbnailR2Key
    ? await getPresignedDownloadUrl(clip.thumbnailR2Key, 7200).catch(() => undefined)
    : undefined;
  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: "video.other",
      images: image ? [image] : undefined,
      siteName: tenant.name,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: `/clip/${id}`,
    },
  };
}

export default async function ClipDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await loadContext(id);
  if (!ctx) notFound();
  const { tenant, clip, cat } = ctx;

  const related = await getTenantClips(tenant.id, {
    categoryId: clip.categoryId,
    limit: 24,
  });

  const title = prettyTitle({
    rawTitle: clip.title,
    categoryName: cat?.name ?? "",
    createdAt: clip.createdAt,
  });

  const thumb = clip.thumbnailR2Key
    ? await getPresignedDownloadUrl(clip.thumbnailR2Key, 7200).catch(() => null)
    : null;

  const videoObject = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: clip.description ?? `${title}${cat ? ` — ${cat.name}` : ""}`,
    thumbnailUrl: thumb ? [thumb] : undefined,
    uploadDate: clip.createdAt?.toISOString?.() ?? new Date().toISOString(),
    duration: clip.duration
      ? `PT${Math.floor(clip.duration / 60)}M${Math.floor(clip.duration % 60)}S`
      : undefined,
    contentUrl: `https://${tenant.primaryDomain}/clip/${clip.id}`,
    embedUrl: `https://${tenant.primaryDomain}/clip/${clip.id}`,
  };

  return (
    <TenantShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObject) }}
      />
      <AdSlot slot="before_video" />

      <div className="overflow-hidden rounded-xl bg-black">
        <VideoPlayer clipId={clip.id} />
      </div>

      <div className="mt-5 space-y-3">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight md:text-2xl">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
          {cat && (
            <Link
              href={`/category/${cat.slug}`}
              className="rounded-md px-2.5 py-1 font-medium text-white/80 hover:text-white"
              style={{ background: "var(--tenant-panel)" }}
            >
              {cat.name}
            </Link>
          )}
          {clip.duration ? (
            <span className="tabular-nums text-white/50">
              {Math.floor(clip.duration / 60)}:
              {String(Math.floor(clip.duration % 60)).padStart(2, "0")}
            </span>
          ) : null}
        </div>
        {clip.description && (
          <p className="rounded-lg border border-white/5 p-3 text-sm leading-relaxed text-white/70">
            {clip.description}
          </p>
        )}
      </div>

      <AdSlot slot="after_video" />
      <AdSlot slot="under_title" />

      <div className="mt-12">
        <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-white/50">
          คลิปที่เกี่ยวข้อง
        </h2>
        <ClipFeed clips={related.filter((c) => c.id !== clip.id)} />
      </div>
    </TenantShell>
  );
}
