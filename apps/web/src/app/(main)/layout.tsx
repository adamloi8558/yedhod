import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { BannerSlider } from "@/components/banner-slider";
import { SiteFooter } from "@/components/site-footer";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { getActiveBanners } from "@/lib/banners";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [allCategories, banners] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder)),
    getActiveBanners(),
  ]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="hidden w-72 flex-shrink-0 border-r border-border/40 bg-card/30 md:block transition-smooth">
        <Sidebar categories={allCategories} />
      </aside>
      <MobileSidebar categories={allCategories} />
      <main className="flex-1 overflow-y-auto bg-background">
        {banners.length > 0 && <BannerSlider banners={banners} />}
        {children}
        <SiteFooter />
      </main>
    </div>
  );
}
