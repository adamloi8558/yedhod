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

export const dynamic = "force-dynamic";

export default async function ClipDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const clip = await getTenantClipInScope(tenant.id, id);
  if (!clip) notFound();

  const [cat] = await db
    .select({ name: categories.name, slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, clip.categoryId))
    .limit(1);

  const related = await getTenantClips(tenant.id, {
    categoryId: clip.categoryId,
    limit: 24,
  });

  return (
    <TenantShell>
      <AdSlot slot="before_video" />

      <div className="overflow-hidden rounded-xl bg-black">
        <VideoPlayer clipId={clip.id} />
      </div>

      <div className="mt-4 space-y-3">
        <h1 className="text-lg font-bold leading-tight md:text-xl">{clip.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          {cat && (
            <Link
              href={`/category/${cat.slug}`}
              className="rounded-md px-2 py-1 hover:text-white"
              style={{ background: "var(--tenant-panel)" }}
            >
              {cat.name}
            </Link>
          )}
          {clip.duration ? (
            <span className="tabular-nums">{Math.floor(clip.duration / 60)}:{String(Math.floor(clip.duration % 60)).padStart(2, "0")}</span>
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

      <div className="mt-10">
        <h2 className="mb-4 text-base font-semibold uppercase tracking-wider text-white/60">
          คลิปที่เกี่ยวข้อง
        </h2>
        <ClipFeed clips={related.filter((c) => c.id !== clip.id)} />
      </div>
    </TenantShell>
  );
}
