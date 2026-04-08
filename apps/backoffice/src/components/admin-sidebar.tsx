"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  FolderOpen,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@kodhom/ui/lib/utils";
import { Button } from "@kodhom/ui/components/button";
import { authClient } from "@/lib/auth-client";
import { useMobileMenu } from "@/components/mobile-menu";

const navItems = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/dashboard/categories", label: "หมวดหมู่", icon: FolderOpen },
  { href: "/dashboard/clips", label: "คลิป", icon: Film },
  { href: "/dashboard/pricing", label: "แพ็กเกจ", icon: Tag },
  { href: "/dashboard/users", label: "ผู้ใช้", icon: Users },
  { href: "/dashboard/payments", label: "การชำระเงิน", icon: CreditCard },
  { href: "/dashboard/withdraw", label: "ถอนเงิน", icon: Wallet },
  { href: "/dashboard/config", label: "ตั้งค่า", icon: Settings },
];

interface AdminSidebarProps {
  user: { name: string; email: string };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, close } = useMobileMenu();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const sidebarContent = (
    <aside className="flex h-full w-[260px] flex-shrink-0 flex-col border-r border-border/60 bg-card">
      <div className="flex h-14 items-center justify-between gap-2.5 border-b border-border/60 px-5">
        <img src="/logo.png" alt="เย็ดโหด.com" className="h-8 w-auto" />
        <button onClick={close} className="lg:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent/80 hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className={cn(
                "h-4 w-4 flex-shrink-0 transition-colors duration-150",
                isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
              )} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-3">
        <div className="mb-2 rounded-lg bg-accent/40 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground transition-colors duration-150 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          ออกจากระบบ
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:block h-full">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="relative z-10 h-full w-[260px] animate-slide-in-left shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
