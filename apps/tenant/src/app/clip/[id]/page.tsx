import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
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
  // Absolute proxy URL on the tenant's own domain — keeps og:image /
  // twitter:image on-brand and out of the R2 hostname.
  const image = clip.thumbnailR2Key
    ? `https://${tenant.primaryDomain}/api/clips/${clip.id}/thumbnail`
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
    ? `https://${tenant.primaryDomain}/api/clips/${clip.id}/thumbnail`
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

      <div className="mx-auto max-w-5xl">
        <AdSlot slot="before_video" />

        <div
          className="overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: "#000" }}
        >
          <VideoPlayer clipId={clip.id} />
        </div>

        <div className="mt-6 text-center">
          {cat && (
            <p className="mb-2 text-xs uppercase tracking-[0.3em] text-white/40">
              <Link
                href={`/category/${cat.slug}`}
                className="hover:text-white/70"
              >
                {cat.name}
              </Link>
            </p>
          )}
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
            {title}
          </h1>
          {clip.duration ? (
            <p className="mt-2 text-xs tabular-nums text-white/40">
              ระยะเวลา · {Math.floor(clip.duration / 60)}:
              {String(Math.floor(clip.duration % 60)).padStart(2, "0")}
            </p>
          ) : null}
        </div>

        {clip.description && (
          <p className="mx-auto mt-6 max-w-3xl rounded-xl border border-white/5 bg-white/5 p-4 text-center text-sm leading-relaxed text-white/70">
            {clip.description}
          </p>
        )}

        <AdSlot slot="after_video" />
        <AdSlot slot="under_title" />
      </div>

      <div className="mt-14">
        <div className="mb-6 flex items-baseline justify-center gap-3">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white/80">
            คลิปที่เกี่ยวข้อง
          </h2>
        </div>
        <ClipFeed clips={related.filter((c) => c.id !== clip.id)} />
      </div>
    </TenantShell>
  );
}
