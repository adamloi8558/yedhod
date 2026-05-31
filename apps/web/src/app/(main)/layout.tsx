import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { BannerSlider } from "@/components/banner-slider";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { ScrollReset } from "@/components/scroll-reset";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq, and, isNull, isNotNull, asc, desc, count } from "drizzle-orm";
import { getActiveBanners } from "@/lib/banners";
import { getSession } from "@/lib/auth-server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarParents, sidebarChildCounts, banners, session] = await Promise.all([
    // Slim sidebar: only top-level (parent) categories. Subcategories live
    // on /categories/[slug]. Pinned ones float to the top.
    db
      .select()
      .from(categories)
      .where(and(eq(categories.isActive, true), isNull(categories.parentId)))
      .orderBy(desc(categories.isPinned), asc(categories.sortOrder))
      .limit(15),
    // Count of children per parent — sidebar uses this to route to
    // /categories/[slug] (sub list) vs /category/[slug] (clip feed).
    db
      .select({ parentId: categories.parentId, n: count() })
      .from(categories)
      .where(and(eq(categories.isActive, true), isNotNull(categories.parentId)))
      .groupBy(categories.parentId),
    getActiveBanners(),
    getSession(),
  ]);

  const childCountByParent = new Map(
    sidebarChildCounts.map((r) => [r.parentId as string, r.n])
  );
  const sidebarCategories = sidebarParents.map((cat) => ({
    ...cat,
    childCount: childCountByParent.get(cat.id) ?? 0,
  }));

  // Better Auth sets session.impersonatedBy when admin is acting as a user.
  const impersonatedBy =
    (session?.session as { impersonatedBy?: string | null } | undefined)
      ?.impersonatedBy ?? null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {impersonatedBy && session?.user && (
        <ImpersonationBanner asUserName={session.user.name} />
      )}
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
    </div>
  );
}
