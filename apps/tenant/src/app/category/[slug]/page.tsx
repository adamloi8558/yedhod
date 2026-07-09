import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getCurrentTenant();

  // Parents in the tenant nav may not be accessLevel='member' (they're org
  // buckets). Allow both, and let the clip query enforce member on the leaves.
  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);
  if (!cat) notFound();

  const enabled = await getTenantCategories(tenant.id);
  if (!enabled.find((c) => c.id === cat.id)) notFound();

  const clips = await getTenantClips(tenant.id, {
    categoryId: cat.id,
    limit: 60,
  });

  return (
    <TenantShell>
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">หมวดหมู่</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{cat.name}</h1>
        <p className="mt-2 text-sm text-white/40">{clips.length} คลิป</p>
      </div>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
