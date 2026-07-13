"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Lock, Crown, Play, Eye, Heart } from "lucide-react";
import { formatDuration, formatThaiDate } from "@kodhom/ui/lib/utils";
import { clipDisplayTitle } from "@/lib/seo/metadata";
import { gradientThumbStyle } from "@/lib/gradient-thumb";
import { cn } from "@kodhom/ui/lib/utils";

// Thai-friendly compact number ("1.2K", "3.4M"). We round down so we never
// over-state — 999 stays 999, 1000 → "1K".
function formatCompactCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return n.toLocaleString("th-TH");
  if (n < 10_000) return (Math.floor(n / 100) / 10).toFixed(1) + "K";
  if (n < 1_000_000) return Math.floor(n / 1000) + "K";
  if (n < 10_000_000) return (Math.floor(n / 100_000) / 10).toFixed(1) + "M";
  return Math.floor(n / 1_000_000) + "M";
}

interface ClipCardProps {
  clip: {
    id: string;
    title: string;
    description?: string | null;
    thumbnailR2Key?: string | null;
    duration?: number | null;
    accessLevel: "member" | "vip";
    createdAt: Date;
    viewCount?: number | null;
    likeCount?: number | null;
  };
  categoryName?: string;
  thumbnailUrl?: string;
  hasAccess: boolean;
  isLoggedIn: boolean;
  /** Optional Netflix-style ranking overlay (1..10). */
  rank?: number;
  /** Render title/meta below the tile. Off for the ranked row so the tile
   *  itself stays a pure "poster". */
  compact?: boolean;
}

export function ClipCard({
  clip,
  categoryName,
  thumbnailUrl,
  hasAccess,
  isLoggedIn,
  rank,
  compact = false,
}: ClipCardProps) {
  const resolvedThumb =
    thumbnailUrl ?? (clip.thumbnailR2Key ? `/api/thumbnail/${clip.id}` : undefined);
  const isVip = clip.accessLevel === "vip";

  const targetHref = hasAccess
    ? `/clip/${clip.id}`
    : !isLoggedIn
      ? `/login?redirect=${encodeURIComponent(`/clip/${clip.id}`)}`
      : "/pricing";

  const durationText = clip.duration ? formatDuration(clip.duration) : null;
  const metaLine =
    categoryName && durationText
      ? `${categoryName} • ${durationText}`
      : categoryName || durationText || "";

  const ariaLabel =
    categoryName && durationText
      ? `ดูคลิป${categoryName} ความยาว ${durationText}`
      : `ดูคลิป${categoryName ?? ""}`;

  const displayTitle = clipDisplayTitle(clip, { name: categoryName ?? "" });
  const gradStyle = gradientThumbStyle(clip.id);

  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const HOLD_DELAY_MS = 450;

  const beginPreview = useCallback(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => setPreviewActive(true), HOLD_DELAY_MS);
  }, []);

  const endPreview = useCallback(() => {
    if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
    setPreviewActive(false);
  }, []);

  const showFallbackGradient = !resolvedThumb || thumbFailed;

  return (
    <Link
      href={targetHref}
      aria-label={ariaLabel}
      className={cn(
        "group relative flex flex-col rounded-2xl overflow-hidden transition-smooth-lg",
        !compact && "hover:-translate-y-1"
      )}
      onMouseEnter={beginPreview}
      onMouseLeave={endPreview}
      onTouchStart={beginPreview}
      onTouchEnd={(e) => {
        if (previewActive) e.preventDefault();
        endPreview();
      }}
      onTouchCancel={endPreview}
    >
      {/* Thumbnail wrapper — the ranked layout wraps this in a bigger flex
          row so the rank digit can slot on the left. */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-card",
          "ring-1 ring-white/5 shadow-[0_10px_40px_-16px_oklch(0_0_0/0.9)]",
          "group-hover:ring-primary/40 group-hover:shadow-[0_16px_50px_-16px_oklch(0.55_0.24_20/0.5)]",
          "transition-smooth-lg",
          "aspect-video"
        )}
      >
        {!showFallbackGradient ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedThumb}
            alt=""
            width={480}
            height={270}
            className="h-full w-full object-cover transition-smooth-lg group-hover:scale-[1.06]"
            loading="lazy"
            decoding="async"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="gradient-thumb h-full w-full" style={gradStyle}>
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-3xl md:text-4xl font-bold text-white/70">
                {(categoryName?.charAt(0) ?? "▶").toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* Hold-to-preview video (muted) */}
        {previewActive && (
          <ClipPreviewVideo clipId={clip.id} onDone={endPreview} />
        )}

        {/* Constant subtle scrim from bottom — makes title area / duration
            pill readable even before hover */}
        <div className="pointer-events-none absolute inset-0 scrim-bottom opacity-70" />

        {/* Hover overlay (only when user can play) */}
        {hasAccess && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-primary shadow-[0_10px_30px_oklch(0.68_0.24_20/0.5)] scale-75 group-hover:scale-100 transition-smooth-lg">
                <Play className="h-6 w-6 ml-0.5" fill="currentColor" />
              </div>
            </div>
          </>
        )}

        {/* VIP badge — top-left corner (or top-right when a rank is drawn) */}
        {isVip && (
          <span
            className={cn(
              "absolute top-2 z-10 inline-flex items-center gap-1 rounded-full gradient-vip px-2 py-0.5 text-[10px] font-bold text-black/80 shadow-md",
              rank ? "right-2" : "left-2"
            )}
          >
            <Crown className="h-3 w-3" fill="currentColor" />
            VIP
          </span>
        )}

        {/* Locked overlay for VIP-only clips */}
        {!hasAccess && isVip && !previewActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
            <Lock className="mb-1 h-6 w-6 text-white drop-shadow" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/95 drop-shadow">
              VIP เท่านั้น
            </span>
            <span className="mt-0.5 text-[10px] text-white/80 drop-shadow">
              กดค้างเพื่อดูตัวอย่าง
            </span>
          </div>
        )}

        {/* Duration pill — bottom-right, glassy */}
        {durationText && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {durationText}
          </span>
        )}

        {/* EP-style tag mimics Synctoon's "EP 12" chip — for us it's the
            category chip, top-left, when no rank is present. */}
        {!rank && categoryName && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
            {categoryName}
          </span>
        )}

        {/* Ranking mark (1..10) — clean white digit at the bottom-left,
            manga-app style. Sits above the constant bottom scrim so it's
            readable on any thumbnail. */}
        {rank && (
          <span className="pointer-events-none absolute bottom-1 left-2 md:bottom-1.5 md:left-3 rank-number tabular-nums">
            {rank}
          </span>
        )}
      </div>

      {/* Info block — only when not `compact` */}
      {!compact && (
        <div className="flex flex-col gap-1.5 pt-3 px-1">
          <h3 className="text-[13px] md:text-sm font-semibold line-clamp-2 text-foreground leading-snug group-hover:text-primary transition-smooth">
            {displayTitle}
          </h3>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
            {metaLine && <span className="truncate font-medium">{metaLine}</span>}
            <time className="flex-shrink-0 tabular-nums">
              {formatThaiDate(new Date(clip.createdAt))}
            </time>
          </div>
          {(clip.viewCount != null || clip.likeCount != null) && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/80 pt-0.5">
              {clip.viewCount != null && clip.viewCount > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Eye className="h-3 w-3" />
                  {formatCompactCount(clip.viewCount)}
                </span>
              )}
              {clip.likeCount != null && clip.likeCount > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Heart className="h-3 w-3" fill="currentColor" />
                  {formatCompactCount(clip.likeCount)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function ClipPreviewVideo({
  clipId,
  onDone,
}: {
  clipId: string;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const startAtRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let stopTimer: ReturnType<typeof setTimeout> = setTimeout(onDone, 11000);

    async function loadPreview() {
      try {
        const res = await fetch(`/api/clips/${clipId}/preview`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPreviewSrc(data.url ?? null);
        startAtRef.current =
          typeof data.teaserStartAt === "number" ? data.teaserStartAt : 0;
        const teaserSec =
          typeof data.teaserDuration === "number" ? data.teaserDuration : 10;
        clearTimeout(stopTimer);
        stopTimer = setTimeout(onDone, Math.round(teaserSec * 1000));
      } catch {
        // Preview is opportunistic.
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(stopTimer);
      const video = videoRef.current;
      if (video) {
        try { video.pause(); } catch {}
      }
    };
  }, [clipId, onDone]);

  if (!previewSrc) return null;

  return (
    <video
      ref={videoRef}
      src={previewSrc}
      muted
      playsInline
      autoPlay
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        const start = startAtRef.current;
        if (start > 0 && start < v.duration - 0.5) {
          try { v.currentTime = start; } catch {}
        }
      }}
      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
    />
  );
}
