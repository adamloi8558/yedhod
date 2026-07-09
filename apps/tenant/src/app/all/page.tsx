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
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
        <h1 className="text-lg font-bold uppercase tracking-wide">
          <span className="border-b-2 pb-2" style={{ borderColor: "var(--tenant-primary)" }}>
            คลิปทั้งหมด
          </span>
        </h1>
        <span className="text-xs text-white/40">
          หน้า {currentPage} / {totalPages} · {total.toLocaleString()} คลิป
        </span>
      </div>

      <ClipFeed clips={clips} />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        basePath="/all"
      />
    </TenantShell>
  );
}
