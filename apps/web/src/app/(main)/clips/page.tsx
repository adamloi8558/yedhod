import { Suspense } from "react";
import Link from "next/link";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, desc, and, count as sqlCount } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import {
  hasActiveSubscriptionReadOnly,
  hasCategoryAccess,
} from "@/lib/access-control";
import { Breadcrumb } from "@/components/breadcrumb";
import { BRAND, canonical, pageTitle } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const revalidate = 300;

const PAGE_SIZE = 60;

export function generateMetadata(): Metadata {
  const title = pageTitle("ดูคลิปทั้งหมด อัปเดตล่าสุด");
  const description = `รวมคลิปวิดีโอผู้ใหญ่ทั้งหมดของ ${BRAND} อัปเดตใหม่ทุกวัน ดูตัวอย่างฟรีก่อนตัดสินใจ สมาชิก VIP ดูเต็มไม่จำกัด สำหรับผู้มีอายุ 18 ปีขึ้นไป`;
  return {
    title,
    description,
    alternates: canonical("/clips"),
    openGraph: {
      type: "website",
      url: "/clips",
      title,
      description,
    },
  };
}

export default async function AllClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [session, countRow] = await Promise.all([
    getSession(),
    db
      .select({ c: sqlCount() })
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true)))
      .then(([row]) => row),
  ]);

  const totalClips = Number(countRow?.c ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalClips / PAGE_SIZE));
  const boundedPage = Math.min(currentPage, totalPages);
  const hasSubscriptionPromise = session?.user
    ? hasActiveSubscriptionReadOnly(session.user.id)
    : Promise.resolve(false);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <Breadcrumb
        items={[
          { name: "หน้าแรก", href: "/" },
          { name: "คลิปทั้งหมด" },
        ]}
      />

      <section className="relative overflow-hidden mb-8 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-accent/50 to-transparent p-6 md:p-10">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80">
          คลังคลิป
        </div>
        <h1 className="mt-2 text-2xl md:text-4xl font-bold tracking-tight">
          คลิปทั้งหมด
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full bg-muted/50 border border-border/30 px-3 py-1 font-medium">
            {totalClips.toLocaleString("th-TH")} คลิป
          </span>
        </div>
        <p className="mt-5 max-w-3xl text-sm md:text-base text-muted-foreground leading-relaxed">
          รวมคลิปทุกหมวด ทั้งคลิปทั่วไปและ VIP เรียงตามวันที่อัปเดตล่าสุด — กดค้างที่คลิปเพื่อดูตัวอย่างฟรีก่อนตัดสินใจ
        </p>
      </section>

      <Suspense fallback={<ClipsGridSkeleton />}>
        <AllClipsGrid
          session={session}
          hasSubscriptionPromise={hasSubscriptionPromise}
          currentPage={boundedPage}
          totalPages={totalPages}
        />
      </Suspense>
    </div>
  );
}

async function AllClipsGrid({
  session,
  hasSubscriptionPromise,
  currentPage,
  totalPages,
}: {
  session: Awaited<ReturnType<typeof getSession>>;
  hasSubscriptionPromise: Promise<boolean>;
  currentPage: number;
  totalPages: number;
}) {
  const offset = (currentPage - 1) * PAGE_SIZE;
  const [allClips, hasSubscription] = await Promise.all([
    db
      .select({
        id: clips.id,
        title: clips.title,
        description: clips.description,
        thumbnailR2Key: clips.thumbnailR2Key,
        duration: clips.duration,
        accessLevel: categories.accessLevel,
        categoryId: clips.categoryId,
        categoryName: categories.name,
        createdAt: clips.createdAt,
      })
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true)))
      .orderBy(desc(clips.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    hasSubscriptionPromise,
  ]);

  const userRole = session?.user
    ? ((session.user as Record<string, unknown>).role as string) ?? "member"
    : "member";

  const clipsWithAccess = allClips.map((clip: (typeof allClips)[number]) => {
    const access = session?.user
      ? hasCategoryAccess(userRole, clip.accessLevel, hasSubscription)
      : false;
    return { clip, hasAccess: access };
  });

  if (clipsWithAccess.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center animate-slide-up">
        <p className="text-muted-foreground font-medium">ยังไม่มีคลิป</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
        {clipsWithAccess.map(({ clip, hasAccess }: (typeof clipsWithAccess)[number]) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            categoryName={clip.categoryName}
            hasAccess={hasAccess}
            isLoggedIn={!!session?.user}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {currentPage > 1 && (
            <Link
              href={`?page=${currentPage - 1}`}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium transition-smooth hover:bg-card"
            >
              ก่อนหน้า
            </Link>
          )}
          <span className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {currentPage.toLocaleString("th-TH")} /{" "}
            {totalPages.toLocaleString("th-TH")}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`?page=${currentPage + 1}`}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium transition-smooth hover:bg-card"
            >
              ถัดไป
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function ClipsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: PAGE_SIZE }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl bg-card/60">
          <div className="aspect-video animate-pulse bg-muted" />
          <div className="space-y-2 p-3 md:p-3.5">
            <div className="h-4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
