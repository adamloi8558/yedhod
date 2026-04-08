"use client";

import { useEffect, useState } from "react";
import { RestrictedOverlay } from "./restricted-overlay";

interface ClipPlayerProps {
  clipId: string;
  hasAccess: boolean;
  isVip: boolean;
}

export function ClipPlayer({ clipId, hasAccess, isVip }: ClipPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    async function fetchStream() {
      try {
        const res = await fetch(`/api/clips/${clipId}/stream`);
        if (!res.ok) {
          setError("ไม่สามารถโหลดวิดีโอได้");
          return;
        }
        const data = await res.json();
        setVideoUrl(data.url);
      } catch {
        setError("เกิดข้อผิดพลาดในการโหลดวิดีโอ");
      } finally {
        setLoading(false);
      }
    }

    fetchStream();
  }, [clipId, hasAccess]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/90 shadow-2xl shadow-black/20 ring-1 ring-white/5">
      {!hasAccess && <RestrictedOverlay isVip={isVip} />}
      {loading && hasAccess && (
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
          src={videoUrl}
          controls
          controlsList="nodownload"
          className="h-full w-full"
          playsInline
        />
      )}
    </div>
  );
}
