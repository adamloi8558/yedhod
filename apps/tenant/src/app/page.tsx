import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tenant = await getCurrentTenant();
  const clips = await getTenantClips(tenant.id, { limit: 60 });
  return (
    <TenantShell>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">คลิปล่าสุด</h1>
        <span className="text-xs text-white/40">อัปเดตทุกวัน</span>
      </div>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
