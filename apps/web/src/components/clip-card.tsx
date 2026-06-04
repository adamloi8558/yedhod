"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Lock, Crown, Play } from "lucide-react";
import { Badge } from "@kodhom/ui/components/badge";
import { formatDuration, formatThaiDate } from "@kodhom/ui/lib/utils";
import { clipDisplayTitle } from "@/lib/seo/metadata";

interface ClipCardProps {
  clip: {
    id: string;
    title: string;
    description?: string | null;
    thumbnailR2Key?: string | null;
    duration?: number | null;
    accessLevel: "member" | "vip";
    createdAt: Date;
  };
  categoryName?: string;
  thumbnailUrl?: string;
  hasAccess: boolean;
  isLoggedIn: boolean;
}

export function ClipCard({
  clip,
  categoryName,
  thumbnailUrl,
  hasAccess,
  isLoggedIn,
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

  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewActive, setPreviewActive] = useState(false);

  const HOLD_DELAY_MS = 450; // long-press/hover delay

  const beginPreview = useCallback(() => {
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => {
      setPreviewActive(true);
    }, HOLD_DELAY_MS);
  }, []);

  const endPreview = useCallback(() => {
    if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
    setPreviewActive(false);
  }, []);

  return (
    <Link
      href={targetHref}
      aria-label={ariaLabel}
      className="group relative flex flex-col rounded-2xl bg-card/60 overflow-hidden transition-smooth hover:bg-card hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
      onMouseEnter={beginPreview}
      onMouseLeave={endPreview}
      onTouchStart={beginPreview}
      onTouchEnd={(e) => {
        // If preview is already showing on mobile, suppress navigation —
        // user held to preview, not tapped to open.
        if (previewActive) {
          e.preventDefault();
        }
        endPreview();
      }}
      onTouchCancel={endPreview}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {resolvedThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedThumb}
            alt=""
            width={320}
            height={180}
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-3xl text-muted-foreground">▶</span>
          </div>
        )}

        {/* Hold-to-preview video (muted) — covers the thumb while previewing.
            Always uses the open /preview endpoint so every hold-press shows
            the same short teaser, regardless of whether the user has full
            access. Full playback only happens on the clip detail page. */}
        {previewActive && (
          <ClipPreviewVideo clipId={clip.id} onDone={endPreview} />
        )}

        {/* Hover overlay (only when user can play) */}
        {hasAccess && (
          <>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/95 text-white shadow-lg shadow-primary/40 scale-75 group-hover:scale-100 transition-smooth">
                <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
              </div>
            </div>
          </>
        )}

        {/* VIP badge — top-left corner, on top of image (no blur) */}
        {isVip && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-amber-500/30">
            <Crown className="h-3 w-3" fill="currentColor" />
            VIP
          </span>
        )}

        {/* Locked overlay for VIP-only clips, sharp (no blur).
            Hidden while teaser is playing so user can see the preview. */}
        {!hasAccess && isVip && !previewActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55">
            <Lock className="mb-1 h-6 w-6 text-white drop-shadow" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/95 drop-shadow">
              VIP เท่านั้น
            </span>
            <span className="mt-0.5 text-[10px] text-white/80 drop-shadow">
              กดค้างเพื่อดูตัวอย่าง
            </span>
          </div>
        )}

        {/* Duration pill — bottom-right */}
        {durationText && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {durationText}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-3 md:p-3.5">
        <h3 className="text-[13px] md:text-sm font-semibold line-clamp-2 text-foreground leading-snug group-hover:text-primary transition-smooth">
          {displayTitle}
        </h3>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
          {metaLine && <span className="truncate font-medium">{metaLine}</span>}
          <time className="flex-shrink-0 tabular-nums">
            {formatThaiDate(new Date(clip.createdAt))}
          </time>
        </div>
      </div>
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
    // Always use the open /preview endpoint so every hold-press shows the
    // same short teaser, regardless of subscription status. Full playback
    // is reserved for the clip detail page.
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
        try {
          video.pause();
        } catch {}
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
          try {
            v.currentTime = start;
          } catch {
            // Some browsers can't seek before "loadeddata" — fall back to 0.
          }
        }
      }}
      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
    />
  );
}
