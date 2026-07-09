import type { MetadataRoute } from "next";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const tenant = await getCurrentTenant();
    const base = `https://${tenant.primaryDomain}`;

    const [cats, clips] = await Promise.all([
      getTenantCategories(tenant.id),
      getTenantClips(tenant.id, { limit: 1000 }),
    ]);

    const now = new Date();

    return [
      { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
      ...cats.map((c) => ({
        url: `${base}/category/${c.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...clips.map((c) => ({
        url: `${base}/clip/${c.id}`,
        lastModified: c.createdAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return [];
  }
}
