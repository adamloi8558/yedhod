"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crown, LogIn, Play } from "lucide-react";

interface ClipPlayerProps {
  clipId: string;
  hasAccess: boolean;
  isVip: boolean;
  isLoggedIn: boolean;
}

export function ClipPlayer({ clipId, hasAccess, isVip, isLoggedIn }: ClipPlayerProps) {
  // Subscribers stream the full clip. Everyone else plays the open teaser
  // and gets a CTA overlay when it ends.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [teaserDuration, setTeaserDuration] = useState<number | null>(null);
  const [teaserStartAt, setTeaserStartAt] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teaserEnded, setTeaserEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewBumped = useRef(false);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressKey = `kodhom_watch_${clipId}`;

  const redirectPath = `/clip/${clipId}`;
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath)}`;
  const pricingHref = `/pricing?redirect=${encodeURIComponent(redirectPath)}`;

  useEffect(() => {
    let cancelled = false;
    const endpoint = hasAccess
      ? `/api/clips/${clipId}/stream`
      : `/api/clips/${clipId}/preview`;

    async function fetchStream() {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) {
          setError(hasAccess ? "ไม่สามารถโหลดวิดีโอได้" : null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setVideoUrl(data.url ?? null);
        if (!hasAccess && typeof data.teaserDuration === "number") {
          setTeaserDuration(data.teaserDuration);
        }
        if (!hasAccess && typeof data.teaserStartAt === "number") {
          setTeaserStartAt(data.teaserStartAt);
        }
      } catch {
        if (!cancelled && hasAccess) {
          setError("เกิดข้อผิดพลาดในการโหลดวิดีโอ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStream();
    return () => {
      cancelled = true;
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    };
  }, [clipId, hasAccess]);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;

    // Teaser cut-off (non-subscribers only).
    if (!hasAccess && teaserDuration != null) {
      if (v.currentTime >= teaserStartAt + teaserDuration) {
        v.pause();
        setTeaserEnded(true);
      }
      return;
    }

    // Logged-in full playback: throttle progress saves (~every 8s of play).
    if (!progressSaveTimer.current) {
      progressSaveTimer.current = setTimeout(() => {
        progressSaveTimer.current = null;
        const pos = v.currentTime;
        const dur = Number.isFinite(v.duration) ? v.duration : null;
        // localStorage works for everyone, even guests resuming on this device.
        try {
          window.localStorage.setItem(
            progressKey,
            JSON.stringify({ position: pos, duration: dur, savedAt: Date.now() })
          );
        } catch {
          // localStorage might be disabled — skip silently.
        }
        if (isLoggedIn && pos > 5) {
          fetch(`/api/clips/${clipId}/progress`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ position: pos, duration: dur }),
            keepalive: true,
          }).catch(() => {});
        }
      }, 8000);
    }
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;

    // Teaser mode: seek to mid-clip and arm the hard-stop fallback.
    if (!hasAccess && teaserDuration != null) {
      if (v && teaserStartAt > 0 && teaserStartAt < v.duration - 0.5) {
        try {
          v.currentTime = teaserStartAt;
        } catch {
          // Some browsers can't seek immediately on loadedmetadata.
        }
      }
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        setTeaserEnded(true);
      }, Math.round((teaserDuration + 0.5) * 1000));
      return;
    }

    // Full playback: resume from saved position if any, then bump view once.
    if (v) {
      // Prefer server progress (already fetched into the response) — but
      // we don't have it here; fall back to localStorage which works for
      // both logged-in users on this device and guests with access.
      try {
        const raw = window.localStorage.getItem(progressKey);
        if (raw) {
          const saved = JSON.parse(raw) as { position?: number };
          const pos = Number(saved?.position);
          if (
            Number.isFinite(pos) &&
            pos > 5 &&
            v.duration &&
            pos < v.duration - 5
          ) {
            v.currentTime = pos;
          }
        }
      } catch {
        // Ignore corrupt cached values.
      }
    }

    // View counter bump (fire-and-forget). Once per page-load.
    if (!viewBumped.current) {
      viewBumped.current = true;
      fetch(`/api/clips/${clipId}/view`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    }
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/90 shadow-2xl shadow-black/20 ring-1 ring-white/5">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs text-white/50">กำลังโหลด...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary/20 px-4 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 transition-smooth"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          controls={hasAccess}
          controlsList="nodownload"
          className="h-full w-full"
          playsInline
          autoPlay={!hasAccess}
          muted={!hasAccess}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => !hasAccess && setTeaserEnded(true)}
        />
      )}
      {!hasAccess && !loading && videoUrl && (
        <div
          className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${teaserEnded ? "opacity-0" : "opacity-100"}`}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Play className="h-3 w-3" fill="currentColor" />
            ตัวอย่างฟรี
          </span>
        </div>
      )}
      {!hasAccess && teaserEnded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
          <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${isVip ? "bg-gradient-to-br from-amber-400/25 to-amber-600/25" : "bg-white/10"}`}>
            {!isLoggedIn ? (
              <LogIn className="h-10 w-10 text-white/80" />
            ) : (
              <Crown className="h-10 w-10 text-amber-400 drop-shadow-lg" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white">
            {isVip ? "สมัคร VIP เพื่อดูเต็มเรื่อง" : "เข้าสู่ระบบเพื่อดูเต็มเรื่อง"}
          </h3>
          <p className="text-sm text-white/60 max-w-xs">
            {isVip
              ? "ดูคลิป VIP ทั้งหมดไม่จำกัด อัปเดตต่อเนื่อง"
              : "เข้าสู่ระบบฟรีก็ดูคลิปนี้แบบเต็มได้ทันที"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            <Link
              href={isVip ? pricingHref : isLoggedIn ? pricingHref : loginHref}
              className="inline-flex items-center justify-center rounded-xl gradient-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-smooth hover:shadow-xl hover:shadow-primary/40"
            >
              {isVip ? (
                <span className="inline-flex items-center gap-1.5">
                  <Crown className="h-4 w-4" /> สมัคร VIP เพื่อดูต่อ
                </span>
              ) : !isLoggedIn ? (
                "เข้าสู่ระบบ"
              ) : (
                "อัปเกรดเพื่อดู"
              )}
            </Link>
            {!hasAccess && (
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = teaserStartAt;
                    videoRef.current.play().catch(() => {});
                    setTeaserEnded(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 backdrop-blur transition-smooth hover:bg-white/10"
              >
                ดูตัวอย่างอีกครั้ง
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
