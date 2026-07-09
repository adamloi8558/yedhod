import type { Metadata } from "next";
import Link from "next/link";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantClips } from "@/lib/tenant-queries";

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
  const [clips, cats] = await Promise.all([
    getTenantClips(tenant.id, { limit: 60 }),
    getTenantCategories(tenant.id),
  ]);

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

      {/* Hero */}
      <section className="mx-auto mb-12 max-w-3xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
          <span style={{ color: "var(--tenant-primary)" }}>{tenant.name}</span>
        </h1>
        <p className="mt-3 text-base text-white/60 md:text-lg">
          {tenant.tagline ?? "คลิปฟรี HD อัปเดตใหม่ทุกวัน"}
        </p>
        <div className="mt-6 flex justify-center gap-3 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/70">
            {clips.length}+ คลิป
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/70">
            {cats.length} หมวด
          </span>
          <span
            className="rounded-full px-3 py-1 font-medium text-black"
            style={{ background: "var(--tenant-primary)" }}
          >
            HD
          </span>
        </div>
      </section>

      {/* Popular categories */}
      {cats.length > 0 && (
        <section className="mx-auto mb-10 max-w-5xl">
          <div className="mb-4 flex items-baseline justify-center gap-3">
            <h2 className="text-lg font-bold uppercase tracking-widest text-white/80">
              หมวดยอดนิยม
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {cats.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/category/${c.slug}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest clips */}
      <section>
        <div className="mb-6 flex items-baseline justify-center gap-3">
          <h2 className="text-xl font-bold uppercase tracking-widest text-white/80">
            คลิปล่าสุด
          </h2>
        </div>
        <ClipFeed clips={clips} />
      </section>
    </TenantShell>
  );
}
