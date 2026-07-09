import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { Pagination } from "@/components/pagination";
import { getCurrentTenant } from "@/lib/tenant";
import {
  countTenantClips,
  getTenantCategories,
  getTenantClips,
} from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const p = Math.max(1, Number(sp.page) || 1);
  const ctx = await loadContext(slug);
  if (!ctx) return { title: "ไม่พบหมวดหมู่" };
  const { tenant, cat } = ctx;
  const suffix = p === 1 ? "" : ` (หน้า ${p})`;
  const title = `${cat.name}${suffix} — คลิปฟรี HD | ${tenant.name}`;
  const description =
    cat.description ??
    `รวมคลิป ${cat.name} ดูฟรี HD อัปเดตล่าสุดที่ ${tenant.name}`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: tenant.name, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    alternates: {
      canonical: p === 1 ? `/category/${slug}` : `/category/${slug}?page=${p}`,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const currentPage = Math.max(1, Number(sp.page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const ctx = await loadContext(slug);
  if (!ctx) notFound();
  const { tenant, cat } = ctx;

  const [clips, total] = await Promise.all([
    getTenantClips(tenant.id, {
      categoryId: cat.id,
      limit: PAGE_SIZE,
      offset,
    }),
    countTenantClips(tenant.id, { categoryId: cat.id }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages && total > 0) notFound();

  return (
    <TenantShell>
      <section className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          หมวดหมู่
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          {cat.name}
        </h1>
        <p className="mt-2 text-sm text-white/50">
          หน้า {currentPage} / {totalPages} · {total.toLocaleString()} คลิป
        </p>
      </section>

      <ClipFeed clips={clips} />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath={`/category/${slug}`}
      />
    </TenantShell>
  );
}
