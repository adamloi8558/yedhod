"use client";

import { useEffect, useState } from "react";
import { cn } from "@kodhom/ui/lib/utils";

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string;
  alt?: string;
}

const ROTATE_MS = 5000;

export function BannerSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 md:px-6 md:pt-6 lg:px-8">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="แบนเนอร์โปรโมชัน"
        className="relative overflow-hidden rounded-2xl ring-1 ring-white/5 bg-card/40 glow-soft"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b, i) => {
            const isActive = i === index;
            return (
              <div
                key={b.id}
                className={cn("block w-full flex-shrink-0", !isActive && "pointer-events-none")}
                aria-hidden={!isActive ? "true" : undefined}
                tabIndex={!isActive ? -1 : undefined}
              >
                <a
                  href={b.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={!isActive ? -1 : undefined}
                >
                  <img
                    src={b.imageUrl}
                    alt={b.alt ?? ""}
                    className="h-auto w-full"
                    loading="eager"
                  />
                </a>
              </div>
            );
          })}
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`สไลด์ ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-primary glow-primary"
                    : "w-1.5 bg-white/50 hover:bg-white/80"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
