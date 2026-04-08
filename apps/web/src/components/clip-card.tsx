"use client";

import Link from "next/link";
import { Lock, Crown, Play } from "lucide-react";
import { Badge } from "@kodhom/ui/components/badge";
import { formatDuration, formatThaiDate } from "@kodhom/ui/lib/utils";

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
  thumbnailUrl?: string;
  hasAccess: boolean;
}

export function ClipCard({ clip, thumbnailUrl, hasAccess }: ClipCardProps) {
  const isVip = clip.accessLevel === "vip";

  return (
    <Link
      href={hasAccess ? `/clip/${clip.id}` : `/pricing`}
      className="group relative flex gap-3 rounded-2xl bg-card/60 p-3 transition-smooth hover:bg-card hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-28 sm:w-32 md:w-40 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-2xl text-muted-foreground">▶</span>
          </div>
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
        {/* Play icon on hover */}
        {hasAccess && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg shadow-primary/30 scale-75 group-hover:scale-100 transition-smooth">
              <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}
        {/* Duration badge */}
        {clip.duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatDuration(clip.duration)}
          </span>
        )}
        {/* Restricted overlay - only blur VIP clips for non-VIP users */}
        {!hasAccess && isVip && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px]">
            <Lock className="mb-1 h-5 w-5 text-white/80" />
            <span className="text-[10px] font-medium text-white/70">VIP</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-2">
            {isVip && (
              <Badge variant="vip" className="flex-shrink-0 gap-1 animate-pulse-glow">
                <Crown className="h-3 w-3" />
                VIP
              </Badge>
            )}
          </div>
        </div>
        <time className="text-[11px] text-muted-foreground/70">
          {formatThaiDate(new Date(clip.createdAt))}
        </time>
      </div>
    </Link>
  );
}
