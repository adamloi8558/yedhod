"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Search, Menu, LogOut, User, Monitor } from "lucide-react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Avatar, AvatarFallback, AvatarImage } from "@kodhom/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kodhom/ui/components/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import { useSidebarStore } from "@/lib/sidebar-store";

interface HeaderProps {
  session: {
    user: { id: string; name: string; email: string; image?: string | null; role?: string };
  } | null;
}

export function Header({ session }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { toggle } = useSidebarStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Hide sidebar toggle on auth pages (no sidebar there)
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 glass-strong">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {!isAuthPage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 md:hidden hover:bg-accent/80 transition-smooth"
            onClick={toggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <Link href="/" className="flex-shrink-0">
          <img src="/logo.png" alt="โคตรหอม.com" className="h-8 w-auto sm:h-9" />
        </Link>

        <form onSubmit={handleSearch} className="relative ml-2 hidden flex-1 max-w-md md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="ค้นหาคลิป..."
            className="pl-9 bg-accent/50 border-border/50 focus:bg-accent focus:border-primary/40 focus:ring-primary/20 transition-smooth rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="ml-auto flex items-center gap-1">
          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden hover:bg-accent/80 transition-smooth"
            onClick={() => router.push("/search")}
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative overflow-hidden hover:bg-accent/80 transition-smooth"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
          </Button>

          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-smooth p-0">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarImage src={session.user.image ?? undefined} alt={session.user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs sm:text-sm">
                      {session.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-strong border-border/50 rounded-xl p-1">
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-semibold">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">{session.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem asChild className="rounded-lg transition-smooth cursor-pointer">
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    โปรไฟล์
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-lg transition-smooth cursor-pointer">
                  <Link href="/devices">
                    <Monitor className="mr-2 h-4 w-4 text-muted-foreground" />
                    จัดการอุปกรณ์
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-lg transition-smooth cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs hover:bg-accent/80 transition-smooth rounded-lg sm:px-3 sm:text-sm">
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
              <Button size="sm" asChild className="h-8 px-2 text-xs gradient-primary text-white border-0 rounded-lg shadow-md hover:shadow-lg transition-smooth sm:px-3 sm:text-sm">
                <Link href="/register">สมัคร</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
