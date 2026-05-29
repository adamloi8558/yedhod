import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { BannerSlider } from "@/components/banner-slider";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { ScrollReset } from "@/components/scroll-reset";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq, and, or, isNull, asc, desc } from "drizzle-orm";
import { getActiveBanners } from "@/lib/banners";
import { getSession } from "@/lib/auth-server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCategories, banners, session] = await Promise.all([
    // Slim sidebar: only pinned or top-level (no parent) categories.
    db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.isActive, true),
          or(eq(categories.isPinned, true), isNull(categories.parentId))
        )
      )
      .orderBy(desc(categories.isPinned), asc(categories.sortOrder))
      .limit(15),
    getActiveBanners(),
    getSession(),
  ]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ScrollReset />
      <aside className="hidden w-72 flex-shrink-0 border-r border-border/40 bg-card/30 md:block transition-smooth">
        <Sidebar categories={sidebarCategories} />
      </aside>
      <MobileSidebar categories={sidebarCategories} />
      {/* Extra bottom padding on mobile so the fixed bottom nav never covers content. */}
      <main id="main" className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
        {banners.length > 0 && <BannerSlider banners={banners} />}
        {children}
        <SiteFooter />
      </main>
      <BottomNav isLoggedIn={!!session?.user} />
    </div>
  );
}
