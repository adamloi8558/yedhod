"use client";

import { MobileMenuButton } from "@/components/mobile-menu";

export function MobileHeader() {
  return (
    <header className="flex h-12 items-center gap-3 border-b border-border/60 bg-card/50 px-3 lg:hidden">
      <MobileMenuButton />
      <img src="/logo.png" alt="เย็ดโหด.com" className="h-7 w-auto" />
    </header>
  );
}
