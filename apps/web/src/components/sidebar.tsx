"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, Bookmark, Crown, User, Compass } from "lucide-react";
import { ScrollArea } from "@kodhom/ui/components/scroll-area";
import { cn } from "@kodhom/ui/lib/utils";
import { gradientThumbStyle } from "@/lib/gradient-thumb";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  childCount?: number;
}

interface SidebarProps {
  categories: Category[];
}

/**
 * Desktop-primary sidebar (also rendered inside the mobile drawer).
 *
 * Layout mirrors the Synctoon concept: a small "main nav" block at the top,
 * then a "หมวดหมู่" list where each item shows a tiny gradient tile instead
 * of a plain letter — matches the poster aesthetic of the rest of the app.
 */
export function Sidebar({ categories }: SidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const activeSlug = params?.slug as string | undefined;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <ScrollArea className="h-full">
      <nav className="p-3 space-y-6">
        {/* -------- Main nav -------- */}
        <div className="space-y-0.5">
          <NavItem href="/" icon={<Home className="h-4 w-4" />} active={isActive("/")} label="หน้าแรก" />
          <NavItem href="/categories" icon={<Compass className="h-4 w-4" />} active={pathname === "/categories"} label="สำรวจ" />
          <NavItem href="/search" icon={<Search className="h-4 w-4" />} active={isActive("/search")} label="ค้นหา" />
          <NavItem href="/clips" icon={<Bookmark className="h-4 w-4" />} active={pathname === "/clips"} label="คลิปทั้งหมด" />
          <NavItem href="/pricing" icon={<Crown className="h-4 w-4 text-vip" />} active={isActive("/pricing")} label="สมาชิก VIP" />
          <NavItem href="/profile" icon={<User className="h-4 w-4" />} active={isActive("/profile")} label="โปรไฟล์" />
        </div>

        {/* -------- Categories -------- */}
        {categories.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                หมวดหมู่
              </h3>
              <Link
                href="/categories"
                className="text-[10px] font-semibold text-muted-foreground/70 hover:text-primary transition-smooth"
              >
                ดูทั้งหมด
              </Link>
            </div>
            <div className="space-y-0.5">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={
                    (cat.childCount ?? 0) > 0
                      ? `/categories/${cat.slug}`
                      : `/category/${cat.slug}`
                  }
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-smooth hover:bg-white/5",
                    activeSlug === cat.slug && "bg-white/10 text-foreground"
                  )}
                >
                  {activeSlug === cat.slug && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-primary glow-primary" />
                  )}
                  {cat.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cat.coverImage}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded-lg object-cover ring-1 ring-white/10 transition-smooth group-hover:ring-primary/40"
                    />
                  ) : (
                    <div
                      className="gradient-thumb h-9 w-9 flex-shrink-0 rounded-lg ring-1 ring-white/10 flex items-center justify-center transition-smooth group-hover:ring-primary/40"
                      style={gradientThumbStyle(cat.id)}
                    >
                      <span className="font-display text-sm font-bold text-white/85">
                        {cat.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{cat.name}</p>
                    {cat.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{cat.description}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All categories CTA */}
        <Link
          href="/categories"
          className="group mx-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-smooth hover:bg-white/[0.06] hover:text-foreground"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          ดูทุกหมวดหมู่
        </Link>
      </nav>
    </ScrollArea>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth hover:bg-white/5",
        active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-primary glow-primary" />
      )}
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-smooth",
          active
            ? "bg-primary/15 text-primary"
            : "bg-white/[0.04] text-muted-foreground group-hover:bg-white/[0.08] group-hover:text-foreground"
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
