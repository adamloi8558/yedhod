import { db } from "@kodhom/db";
import { clips, categories } from "@kodhom/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth-server";
import { ClipCard } from "@/components/clip-card";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { hasActiveSubscription, hasCategoryAccess } from "@/lib/access-control";
import { WebsiteJsonLd } from "@/components/jsonld/website";
import { BRAND, BRAND_TAGLINE, canonical } from "@/lib/seo/metadata";
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

  const allClips = await db
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
    .limit(50);

  let hasSub = false;
  let userRole = "member";
  if (session?.user) {
    userRole = (session.user as Record<string, unknown>).role as string ?? "member";
    hasSub = await hasActiveSubscription(session.user.id);
  }

  const clipsWithAccess = await Promise.all(
    allClips.map(async (clip: typeof allClips[number]) => {
      let thumbnailUrl: string | undefined;
      if (clip.thumbnailR2Key) {
        try {
          thumbnailUrl = await getPresignedDownloadUrl(clip.thumbnailR2Key, 3600);
        } catch {
          // ignore
        }
      }

      const access = session?.user
        ? hasCategoryAccess(userRole, clip.accessLevel, hasSub)
        : false;

      return { clip, thumbnailUrl, hasAccess: access };
    })
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 animate-fade-in">
      <WebsiteJsonLd />

      {/* Brand Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-primary/15 via-accent/40 to-background p-6 md:p-10 lg:p-14 mb-10 md:mb-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <h1 className="relative text-3xl md:text-5xl lg:text-6xl font-bold gradient-text tracking-tight">
          {BRAND}
        </h1>
        <p className="relative mt-3 md:mt-4 text-sm md:text-lg text-muted-foreground max-w-xl">
          {BRAND_TAGLINE} คัดสรรอย่างพิถีพิถันสำหรับผู้มีอายุ 18 ปีขึ้นไป
        </p>
      </section>

      {/* Latest Clips section */}
      <section aria-labelledby="latest-heading" className="mb-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="latest-heading" className="text-lg md:text-xl font-semibold tracking-tight">
            คลิปล่าสุด
          </h2>
          <span className="text-xs text-muted-foreground">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {clipsWithAccess.map(({ clip, thumbnailUrl, hasAccess }: typeof clipsWithAccess[number]) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                categoryName={clip.categoryName}
                thumbnailUrl={thumbnailUrl}
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
