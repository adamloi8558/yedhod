import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

async function loadContext(slug: string) {
  const tenant = await getCurrentTenant();
  const [cat] = await db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);
  if (!cat) return null;
  const enabled = await getTenantCategories(tenant.id);
  if (!enabled.find((c) => c.id === cat.id)) return null;
  return { tenant, cat };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await loadContext(slug);
  if (!ctx) return { title: "ไม่พบหมวดหมู่" };
  const { tenant, cat } = ctx;
  const title = `${cat.name} — คลิปฟรี HD | ${tenant.name}`;
  const description =
    cat.description ??
    `รวมคลิป ${cat.name} ดูฟรี HD อัปเดตล่าสุดที่ ${tenant.name}`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: tenant.name, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await loadContext(slug);
  if (!ctx) notFound();
  const { tenant, cat } = ctx;

  const clips = await getTenantClips(tenant.id, {
    categoryId: cat.id,
    limit: 60,
  });

  return (
    <TenantShell>
      <section className="mx-auto mb-10 max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          หมวดหมู่
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
          {cat.name}
        </h1>
        <p className="mt-3 text-sm text-white/50">{clips.length} คลิป</p>
      </section>
      <ClipFeed clips={clips} />
    </TenantShell>
  );
}
