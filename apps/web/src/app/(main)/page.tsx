import Link from "next/link";
import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { hasActiveSubscription, hasCategoryAccess } from "@/lib/access-control";
import { WebsiteJsonLd } from "@/components/jsonld/website";
import { BRAND, BRAND_TAGLINE, canonical } from "@/lib/seo/metadata";
import { Crown, Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 300;

export function generateMetadata(): Metadata {
  return {
    title: `${BRAND} - ${BRAND_TAGLINE}`,
    description: `${BRAND} รวมคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง อัปเดตใหม่ทุกวัน ดูได้ทุกที่ทุกเวลา สมาชิก VIP ดูไม่จำกัด สำหรับผู้มีอายุ 18 ปีขึ้นไป`,
    alternates: canonical("/"),
    openGraph: {
      type: "website",
      url: "/",
      title: `${BRAND} - ${BRAND_TAGLINE}`,
    },
  };
}

export default async function HomePage() {
  const session = await getSession();

  const [allClips, [clipTotal], [categoryTotal]] = await Promise.all([
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
      .limit(50),
    db
      .select({ count: count() })
      .from(clips)
      .innerJoin(categories, eq(clips.categoryId, categories.id))
      .where(and(eq(clips.isActive, true), eq(categories.isActive, true))),
    db
      .select({ count: count() })
      .from(categories)
      .where(eq(categories.isActive, true)),
  ]);

  let hasSub = false;
  let userRole = "member";
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    hasSub = await hasActiveSubscription(session.user.id);
  }

  const clipsWithAccess = allClips.map((clip: typeof allClips[number]) => {
    const access = session?.user
      ? hasCategoryAccess(userRole, clip.accessLevel, hasSub)
      : false;
    return { clip, hasAccess: access };
  });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <WebsiteJsonLd />

      {/* Brand Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-accent/40 to-background p-6 md:p-10 lg:p-14 mb-10 md:mb-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-vip/10 blur-3xl"
        />

        <span className="relative inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          อัปเดตคลิปใหม่ทุกวัน
        </span>

        <h1 className="relative mt-4 text-3xl md:text-5xl lg:text-6xl font-bold gradient-text tracking-tight">
          {BRAND}
        </h1>
        <p className="relative mt-3 md:mt-4 text-sm md:text-lg text-muted-foreground max-w-xl">
          {BRAND_TAGLINE} คัดสรรอย่างพิถีพิถันสำหรับผู้มีอายุ 18 ปีขึ้นไป
        </p>

        {/* Stats */}
        <div className="relative mt-6 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-card/60 px-3.5 py-2 text-sm font-semibold backdrop-blur">
            <span className="gradient-text tabular-nums">{clipTotal.count.toLocaleString()}</span>
            <span className="text-xs font-normal text-muted-foreground">คลิป</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-card/60 px-3.5 py-2 text-sm font-semibold backdrop-blur">
            <span className="gradient-text tabular-nums">{categoryTotal.count.toLocaleString()}</span>
            <span className="text-xs font-normal text-muted-foreground">หมวดหมู่</span>
          </span>
        </div>

        {/* CTA — adapts to auth/subscription state */}
        <div className="relative mt-6 flex flex-wrap gap-3">
          {!session?.user ? (
            <>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-smooth hover:shadow-xl hover:shadow-primary/30"
              >
                สมัครสมาชิกฟรี
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-5 py-2.5 text-sm font-semibold backdrop-blur transition-smooth hover:bg-card"
              >
                <Crown className="h-4 w-4 text-vip" />
                ดูแพ็กเกจ VIP
              </Link>
            </>
          ) : !hasSub && userRole !== "admin" ? (
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-smooth hover:shadow-xl hover:shadow-primary/30"
            >
              <Crown className="h-4 w-4" />
              อัปเกรดเป็น VIP
            </Link>
          ) : (
            <a
              href="#latest-heading"
              className="inline-flex items-center justify-center rounded-xl gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-smooth hover:shadow-xl hover:shadow-primary/30"
            >
              ดูคลิปล่าสุด
            </a>
          )}
        </div>
      </section>

      {/* Latest Clips section */}
      <section aria-labelledby="latest-heading" className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-6 w-1 rounded-full gradient-primary" />
            <h2 id="latest-heading" className="text-lg md:text-xl font-semibold tracking-tight">
              คลิปล่าสุด
            </h2>
          </div>
          <span className="rounded-full bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
            {clipsWithAccess.length} คลิป
          </span>
        </div>

        {clipsWithAccess.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <span className="text-3xl opacity-40">🎬</span>
            </div>
            <p className="text-muted-foreground font-medium">ยังไม่มีคลิป</p>
            <p className="text-sm text-muted-foreground/60 mt-1">คลิปใหม่กำลังจะมาเร็วๆ นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
            {clipsWithAccess.map(({ clip, hasAccess }: typeof clipsWithAccess[number]) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                hasAccess={hasAccess}
                isLoggedIn={!!session?.user}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
