import type { Metadata } from "next";
import Link from "next/link";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { countTenantClips, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

const HOME_LIMIT = 36;

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
  const [clips, total] = await Promise.all([
    getTenantClips(tenant.id, { limit: HOME_LIMIT }),
    countTenantClips(tenant.id),
  ]);

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: tenant.name,
    url: `https://${tenant.primaryDomain}`,
    inLanguage: "th-TH",
    description: tenant.metaDescription ?? tenant.tagline ?? undefined,
  };

  const hasMore = total > HOME_LIMIT;

  return (
    <TenantShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <ClipFeed clips={clips} />

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Link
            href="/all"
            className="rounded-full px-8 py-3 text-sm font-bold text-black shadow-lg transition hover:opacity-90"
            style={{ background: "var(--tenant-primary)" }}
          >
            ดูทั้งหมด ({total.toLocaleString()} คลิป) →
          </Link>
        </div>
      )}
    </TenantShell>
  );
}
