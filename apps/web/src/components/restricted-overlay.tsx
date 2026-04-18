"use client";

import Link from "next/link";
import { Lock, Crown, LogIn } from "lucide-react";
import { Button } from "@kodhom/ui/components/button";

interface RestrictedOverlayProps {
  isVip?: boolean;
  isLoggedIn: boolean;
  clipId: string;
}

export function RestrictedOverlay({ isVip, isLoggedIn, clipId }: RestrictedOverlayProps) {
  const loginHref = `/login?redirect=${encodeURIComponent(`/clip/${clipId}`)}`;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-xl">
      <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${isVip ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/20 animate-pulse-glow' : 'bg-white/10'} transition-smooth`}>
        {!isLoggedIn ? (
          <LogIn className="h-10 w-10 text-white/80" />
        ) : isVip ? (
          <Crown className="h-10 w-10 text-amber-400 drop-shadow-lg" />
        ) : (
          <Lock className="h-10 w-10 text-white/70" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-white">
        {!isLoggedIn ? "เข้าสู่ระบบเพื่อดูคลิป" : "คอนเทนต์นี้จำกัดการเข้าถึง"}
      </h3>
      <p className="text-sm text-white/60 max-w-xs text-center">
        {!isLoggedIn
          ? "กรุณาเข้าสู่ระบบก่อนรับชม"
          : isVip
            ? "สำหรับสมาชิก VIP เท่านั้น"
            : "กรุณาสมัครสมาชิกเพื่อดูคลิปนี้"}
      </p>
      <Button asChild className="mt-2 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-smooth">
        <Link href={!isLoggedIn ? loginHref : "/pricing"}>
          {!isLoggedIn ? "เข้าสู่ระบบ" : "อัปเกรดเพื่อดู"}
        </Link>
      </Button>
    </div>
  );
}
