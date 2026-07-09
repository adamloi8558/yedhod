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
      <h1 className="mb-6 text-xl font-semibold">คลิปล่าสุด</h1>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
