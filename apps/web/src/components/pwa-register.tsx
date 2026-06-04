"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, X } from "lucide-react";

// Standalone-mode check — if the site is already installed, hide the
// banner entirely.
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari-specific flag for iOS home-screen apps
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = "kodhom_install_dismissed_at";
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // re-show after 7 days

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DISMISS_WINDOW_MS;
}

export function PWARegister() {
  const [visible, setVisible] = useState(false);

  // Register service worker (fire-and-forget) and decide whether to show
  // the install banner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker is opportunistic — banner still works without it.
      });
    }
    if (isStandalone()) return;
    if (isDismissed()) return;

    // Small delay so the banner doesn't fight the first paint.
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage might be disabled — banner just won't persist its
      // dismissal that session.
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="ติดตั้งแอปเย็ดโหด"
      className="fixed inset-x-3 bottom-3 md:bottom-4 z-50 mx-auto max-w-md animate-slide-up"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-3 py-3 pr-2 shadow-2xl shadow-primary/20 backdrop-blur-md">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl gradient-primary text-white shadow-lg shadow-primary/30">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-tight">
            ติดตั้งแอป เย็ดโหด ลงเครื่อง
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            เปิดเร็วกว่า ใช้งานเหมือนแอป — ฟรี ไม่ต้องผ่านสโตร์
          </p>
        </div>
        <Link
          href="/download"
          className="flex-shrink-0 inline-flex items-center justify-center rounded-xl gradient-primary px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary/30 transition-smooth hover:shadow-primary/50"
        >
          ดูวิธี
        </Link>
        <button
          type="button"
          aria-label="ปิด"
          onClick={dismiss}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-muted/50 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
