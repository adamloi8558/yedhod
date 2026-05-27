"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, Crown, User } from "lucide-react";
import { cn } from "@kodhom/ui/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";

interface BottomNavProps {
  isLoggedIn: boolean;
}

/**
 * Mobile-only bottom navigation. Hidden on md+ (desktop uses the left
 * sidebar + header). Categories opens the same off-canvas drawer the
 * header hamburger uses. Colors come from existing theme tokens only.
 */
export function BottomNav({ isLoggedIn }: BottomNavProps) {
  const pathname = usePathname();
  const { toggle, isOpen } = useSidebarStore();

  // Auth pages have no sidebar/feed chrome — keep the bar out of the way.
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  const profileHref = isLoggedIn ? "/profile" : "/login";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-smooth",
      active
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground"
    );

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 glass-strong md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        <Link href="/" className={itemClass(isActive("/"))} aria-label="หน้าแรก">
          <Home className="h-5 w-5" />
          <span>หน้าแรก</span>
        </Link>

        <button
          type="button"
          onClick={toggle}
          aria-label="หมวดหมู่"
          aria-expanded={isOpen}
          className={itemClass(isOpen)}
        >
          <LayoutGrid className="h-5 w-5" />
          <span>หมวดหมู่</span>
        </button>

        <Link
          href="/search"
          className={itemClass(isActive("/search"))}
          aria-label="ค้นหา"
        >
          <Search className="h-5 w-5" />
          <span>ค้นหา</span>
        </Link>

        <Link
          href="/pricing"
          className={itemClass(isActive("/pricing"))}
          aria-label="สมาชิก VIP"
        >
          <Crown className="h-5 w-5" />
          <span>VIP</span>
        </Link>

        <Link
          href={profileHref}
          className={itemClass(isActive("/profile"))}
          aria-label="โปรไฟล์"
        >
          <User className="h-5 w-5" />
          <span>โปรไฟล์</span>
        </Link>
      </div>
    </nav>
  );
}
