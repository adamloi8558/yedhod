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
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">คลิปล่าสุด</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-white/40">
          อัปเดตทุกวัน
        </p>
      </div>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
