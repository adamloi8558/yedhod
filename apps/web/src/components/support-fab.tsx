"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headphones } from "lucide-react";

/**
 * Floating "contact admin" button — visible on every page except
 * auth + the support pages themselves. Sits above the mobile bottom
 * nav and respects safe-area on iPhone.
 */
export function SupportFab() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/payment")
  ) {
    return null;
  }
  return (
    <Link
      href="/support"
      aria-label="ติดต่อแอดมิน"
      className="fixed right-4 z-40 inline-flex items-center gap-2 rounded-full gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-primary/40 ring-1 ring-white/10 transition-smooth hover:scale-105 hover:shadow-2xl hover:shadow-primary/50 md:right-6"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5rem)",
      }}
    >
      <Headphones className="h-5 w-5" />
      <span className="hidden sm:inline">ติดต่อแอดมิน</span>
    </Link>
  );
}
