"use client";

import { useEffect, useState } from "react";

export default function VideoPlayer({ clipId }: { clipId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/clips/${clipId}/stream`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.url) setUrl(j.url);
        else setErr(j.error ?? "error");
      })
      .catch(() => setErr("error"));
    return () => {
      alive = false;
    };
  }, [clipId]);

  if (err)
    return (
      <div className="rounded bg-white/5 p-6 text-center text-white/60">
        โหลดคลิปไม่สำเร็จ
      </div>
    );
  if (!url)
    return <div className="aspect-video w-full animate-pulse rounded bg-white/5" />;
  return (
    <video
      src={url}
      controls
      playsInline
      className="aspect-video w-full rounded bg-black"
    />
  );
}
