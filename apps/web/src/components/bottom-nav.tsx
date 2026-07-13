"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, Crown, User, Compass } from "lucide-react";
import { cn } from "@kodhom/ui/lib/utils";
import { useSidebarStore } from "@/lib/sidebar-store";

interface BottomNavProps {
  isLoggedIn: boolean;
}

/**
 * Mobile bottom nav — hidden on md+.
 *
 * Layout mirrors the Synctoon concept (5 slots with a floating center
 * button), but we swap the concept's "+ upload" for "สำรวจ" because our
 * users don't upload — content is admin-ingested from Telegram.
 */
export function BottomNav({ isLoggedIn }: BottomNavProps) {
  const pathname = usePathname();
  const { toggle, isOpen } = useSidebarStore();

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  const profileHref = isLoggedIn ? "/profile" : "/login";
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Bar background — dark + subtle top border + blur */}
      <div className="glass-strong border-t border-white/5">
        <div className="relative flex items-stretch">
          <NavSlot
            href="/"
            icon={<Home className="h-[22px] w-[22px]" />}
            label="หน้าแรก"
            active={isActive("/")}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label="หมวดหมู่"
            aria-expanded={isOpen}
            className={itemClass(isOpen)}
          >
            <LayoutGrid className="h-[22px] w-[22px]" />
            <span>หมวดหมู่</span>
          </button>

          {/* Floating center — สำรวจ */}
          <div className="flex flex-1 items-start justify-center">
            <Link
              href="/categories"
              aria-label="สำรวจ"
              className={cn(
                "-translate-y-4 relative flex flex-col items-center gap-1",
                "text-[11px] font-semibold"
              )}
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-white",
                  "ring-4 ring-background shadow-[0_10px_30px_-4px_oklch(0.68_0.24_20/0.5)]",
                  "transition-smooth hover:scale-105"
                )}
              >
                <Compass className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <span className="text-primary">สำรวจ</span>
            </Link>
          </div>

          <NavSlot
            href="/pricing"
            icon={<Crown className="h-[22px] w-[22px]" />}
            label="VIP"
            active={isActive("/pricing")}
          />
          <NavSlot
            href={profileHref}
            icon={<User className="h-[22px] w-[22px]" />}
            label="โปรไฟล์"
            active={isActive("/profile")}
          />
        </div>
      </div>
    </nav>
  );
}

const itemClass = (active: boolean) =>
  cn(
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-smooth",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

function NavSlot({
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
    <Link href={href} aria-label={label} className={itemClass(active)}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}
