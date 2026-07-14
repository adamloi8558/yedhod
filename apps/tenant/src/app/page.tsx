import type { Metadata } from "next";
import Link from "next/link";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { AdSlot } from "@/components/ad-slot";
import { getCurrentTenant } from "@/lib/tenant";
import { countTenantClips, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

const HOME_LIMIT = 40;

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

      {/* Section header — pornhub-style tab row */}
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          <span className="border-b-2 pb-2" style={{ borderColor: "var(--tenant-primary)" }}>
            แนะนำ
          </span>
        </h1>
        <span className="text-xs text-white/40">
          {total.toLocaleString()} คลิป
        </span>
      </div>

      <ClipFeed clips={clips} />

      <AdSlot slot="between_sections" />

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Link
            href="/all"
            className="rounded px-6 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
            style={{ background: "var(--tenant-primary)" }}
          >
            ดูทั้งหมด →
          </Link>
        </div>
      )}
    </TenantShell>
  );
}
