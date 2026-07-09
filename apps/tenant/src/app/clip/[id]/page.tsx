import { notFound } from "next/navigation";
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

  const related = await getTenantClips(tenant.id, {
    categoryId: clip.categoryId,
    limit: 24,
  });

  return (
    <TenantShell>
<AdSlot slot="before_video" />
      <VideoPlayer clipId={clip.id} />
      <h1 className="mt-4 text-lg font-semibold">{clip.title}</h1>
      {clip.description && (
        <p className="mt-1 text-sm text-white/70">{clip.description}</p>
      )}
<AdSlot slot="after_video" />
<AdSlot slot="under_title" />
      <hr className="my-6 border-white/10" />
      <h2 className="mb-4 text-base font-semibold">คลิปที่เกี่ยวข้อง</h2>
      <ClipFeed clips={related.filter((c) => c.id !== clip.id)} />
    </TenantShell>
  );
}
