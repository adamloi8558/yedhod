import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { db } from "@kodhom/db";
import { categories } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="hidden w-72 flex-shrink-0 border-r border-border/40 bg-card/30 md:block transition-smooth">
        <Sidebar categories={allCategories} />
      </aside>
      <MobileSidebar categories={allCategories} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
