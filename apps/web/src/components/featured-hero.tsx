"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Bookmark, Crown } from "lucide-react";
import { cn } from "@kodhom/ui/lib/utils";
import { gradientThumbStyle } from "@/lib/gradient-thumb";
import { clipDisplayTitle } from "@/lib/seo/metadata";

interface FeaturedClip {
  id: string;
  title: string;
  description?: string | null;
  thumbnailR2Key?: string | null;
  accessLevel: "member" | "vip";
  categoryName?: string;
  viewCount?: number | null;
  createdAt: Date;
}

interface FeaturedHeroProps {
  clips: FeaturedClip[];
  /** Rendered access map — hero card CTA changes depending on whether the
   *  viewer can already play (Play now) or has to log in / upgrade. */
  isLoggedIn: boolean;
}

const ROTATE_MS = 7000;

export function FeaturedHero({ clips, isLoggedIn }: FeaturedHeroProps) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (clips.length <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    const t = setInterval(() => setI((n) => (n + 1) % clips.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [clips.length, paused]);

  if (clips.length === 0) return null;
  const current = clips[i];

  const displayTitle = clipDisplayTitle(
    { id: current.id, createdAt: current.createdAt },
    { name: current.categoryName ?? "คลิปมาแรง" }
  );
  const isVip = current.accessLevel === "vip";
  const targetHref = !isLoggedIn
    ? `/login?redirect=${encodeURIComponent(`/clip/${current.id}`)}`
    : `/clip/${current.id}`;
  const resolvedThumb = current.thumbnailR2Key
    ? `/api/thumbnail/${current.id}`
    : undefined;

  return (
    <section
      aria-label="คลิปเด่น"
      className="relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop stack — one image per slide, cross-faded. Sit behind the
          text block so the copy is always centered on the same spot. */}
      <div className="relative aspect-[4/5] sm:aspect-[16/10] md:aspect-[16/7] w-full">
        {clips.map((c, idx) => {
          const isActive = idx === i;
          const bgThumb = c.thumbnailR2Key ? `/api/thumbnail/${c.id}` : null;
          return (
            <div
              key={c.id}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-[900ms] ease-out",
                isActive ? "opacity-100" : "opacity-0"
              )}
            >
              {bgThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bgThumb}
                  alt=""
                  className="h-full w-full object-cover"
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              ) : (
                <div
                  className="gradient-thumb h-full w-full"
                  style={gradientThumbStyle(c.id)}
                />
              )}
            </div>
          );
        })}

        {/* Cinematic dark scrim so the copy always stays readable regardless
            of the underlying thumbnail's brightness. */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />

        {/* Ambient warm glow — mirrors the concept mock's radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-float-glow"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-16 h-96 w-96 rounded-full bg-vip/15 blur-3xl animate-float-glow"
          style={{ animationDelay: "2s" }}
        />

        {/* Text/CTA block — bottom-left on desktop, bottom-center on mobile */}
        <div className="absolute inset-x-0 bottom-0 px-6 pb-8 md:px-14 md:pb-14 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/40 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            คลิปเด่น • ฮอตที่สุดตอนนี้
          </span>

          <h2 className="font-display mt-4 text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-lg text-balance leading-[1.05]">
            {displayTitle}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-white/70">
            {current.categoryName && (
              <span className="font-medium">{current.categoryName}</span>
            )}
            {isVip && (
              <span className="inline-flex items-center gap-1 text-vip">
                <Crown className="h-3.5 w-3.5" fill="currentColor" />
                VIP
              </span>
            )}
            {current.viewCount != null && current.viewCount > 0 && (
              <span className="tabular-nums">
                {current.viewCount.toLocaleString("th-TH")} ครั้ง
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Link
              href={targetHref}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black shadow-[0_10px_40px_-10px_rgba(255,255,255,0.6)] transition-smooth hover:scale-[1.02] hover:bg-white/90"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              เล่นเลย
            </Link>
            <Link
              href={`/clip/${current.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-smooth hover:bg-white/20"
            >
              <Bookmark className="h-4 w-4" />
              รายละเอียด
            </Link>
          </div>
        </div>

        {/* Dots — bottom-right */}
        {clips.length > 1 && (
          <div className="absolute bottom-6 right-6 flex items-center gap-1.5">
            {clips.map((c, idx) => (
              <button
                key={c.id}
                onClick={() => setI(idx)}
                aria-label={`สไลด์ ${idx + 1}`}
                aria-current={idx === i ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === i
                    ? "w-8 bg-primary glow-primary"
                    : "w-1.5 bg-white/40 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hidden fallback preload for the first thumb to reduce LCP flash */}
      {resolvedThumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolvedThumb} alt="" className="hidden" aria-hidden loading="eager" />
      )}
    </section>
  );
}
