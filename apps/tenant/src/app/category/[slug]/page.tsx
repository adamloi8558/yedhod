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

  const [cat] = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.slug, slug),
        eq(categories.isActive, true),
        eq(categories.accessLevel, "member")
      )
    )
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
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/40">หมวดหมู่</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{cat.name}</h1>
        </div>
        <span className="text-xs text-white/40">{clips.length} คลิป</span>
      </div>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
