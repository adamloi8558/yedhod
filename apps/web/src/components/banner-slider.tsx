"use client";

import { useEffect, useState } from "react";
import { cn } from "@kodhom/ui/lib/utils";

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string;
}

const ROTATE_MS = 5000;

export function BannerSlider({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 shadow-lg"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => (
            <a
              key={b.id}
              href={b.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full flex-shrink-0"
            >
              <img
                src={b.imageUrl}
                alt="banner"
                className="h-auto w-full"
                loading="eager"
              />
            </a>
          ))}
        </div>

        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`สไลด์ ${i + 1}`}
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
