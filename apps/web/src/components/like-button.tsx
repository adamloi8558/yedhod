"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  clipId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export function LikeButton({
  clipId,
  initialLiked,
  initialCount,
  isLoggedIn,
}: LikeButtonProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (!isLoggedIn) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/clip/${clipId}`)}`
      );
      return;
    }
    // Optimistic update — flip immediately, reconcile when the API returns.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/clips/${clipId}/like`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.likeCount === "number") setCount(data.likeCount);
          if (typeof data.liked === "boolean") setLiked(data.liked);
        }
      } catch {
        // Roll back on network failure so the UI doesn't lie.
        setLiked(liked);
        setCount(initialCount);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-smooth ${
        liked
          ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/15"
          : "border-border/60 bg-card/60 text-foreground hover:border-red-500/40 hover:text-red-400"
      } disabled:opacity-60`}
    >
      <Heart
        className={`h-4 w-4 transition-transform ${liked ? "scale-110" : ""}`}
        fill={liked ? "currentColor" : "none"}
      />
      <span className="tabular-nums">{count.toLocaleString("th-TH")}</span>
    </button>
  );
}
