import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantShell } from "@/components/tenant-shell";
import { ClipFeed } from "@/components/clip-feed";
import { Pagination } from "@/components/pagination";
import { getCurrentTenant } from "@/lib/tenant";
import { countTenantClips, getTenantClips } from "@/lib/tenant-queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  try {
    const t = await getCurrentTenant();
    const title =
      p === 1
        ? `คลิปทั้งหมด | ${t.name}`
        : `คลิปทั้งหมด (หน้า ${p}) | ${t.name}`;
    return {
      title,
      description: `รวมคลิปทั้งหมดใน ${t.name} — อัปเดตใหม่ทุกวัน`,
      alternates: { canonical: p === 1 ? "/all" : `/all?page=${p}` },
      openGraph: { title, siteName: t.name },
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function AllClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const tenant = await getCurrentTenant();
  const [clips, total] = await Promise.all([
    getTenantClips(tenant.id, { limit: PAGE_SIZE, offset }),
    countTenantClips(tenant.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages && total > 0) notFound();

  return (
    <TenantShell>
      <section className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/40">
          คลิปทั้งหมด
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          รวมคลิปทั้งหมด
        </h1>
        <p className="mt-2 text-sm text-white/50">
          หน้า {currentPage} / {totalPages} · {total.toLocaleString()} คลิป
        </p>
      </section>

      <ClipFeed clips={clips} />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/all"
      />
    </TenantShell>
  );
}
