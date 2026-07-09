import type { Metadata } from "next";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const t = await getCurrentTenant();
    const title = t.metaTitle ?? `${t.name} — คลิปฟรี HD อัปเดตทุกวัน`;
    const description =
      t.metaDescription ??
      `${t.name} รวมคลิปวิดีโอ HD ดูฟรี อัปเดตใหม่ทุกวัน ${t.tagline ?? ""}`.trim();
    return {
      title,
      description,
      openGraph: { title, description, siteName: t.name, type: "website" },
      twitter: { card: "summary_large_image", title, description },
      alternates: { canonical: "/" },
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function Home() {
  const tenant = await getCurrentTenant();
  const clips = await getTenantClips(tenant.id, { limit: 60 });

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: tenant.name,
    url: `https://${tenant.primaryDomain}`,
    inLanguage: "th-TH",
    description: tenant.metaDescription ?? tenant.tagline ?? undefined,
  };

  return (
    <TenantShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
