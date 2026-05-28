"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll restoration fix.
 *
 * The app scrolls inside <main id="main" class="overflow-y-auto">, not the
 * window, so Next's built-in scroll-to-top (which targets window) never
 * fires on navigation — opening a clip from a scrolled feed left the new
 * page mid-scroll. This resets the scroll container to the top whenever the
 * route changes.
 */
export function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.getElementById("main");
    if (main) {
      main.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    // Also reset the window, in case any view scrolls there.
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}
