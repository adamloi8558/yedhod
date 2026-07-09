import type { MetadataRoute } from "next";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const tenant = await getCurrentTenant();
    const base = `https://${tenant.primaryDomain}`;
    return {
      rules: [
        { userAgent: "*", allow: "/", disallow: ["/api/", "/_next/"] },
      ],
      sitemap: `${base}/sitemap.xml`,
      host: base,
    };
  } catch {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }
}
