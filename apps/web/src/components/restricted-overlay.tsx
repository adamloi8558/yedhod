"use client";

import Link from "next/link";
import { Lock, Crown } from "lucide-react";
import { Button } from "@kodhom/ui/components/button";

interface RestrictedOverlayProps {
  isVip?: boolean;
}

export function RestrictedOverlay({ isVip }: RestrictedOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-xl">
      <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${isVip ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/20 animate-pulse-glow' : 'bg-white/10'} transition-smooth`}>
        {isVip ? (
          <Crown className="h-10 w-10 text-amber-400 drop-shadow-lg" />
        ) : (
          <Lock className="h-10 w-10 text-white/70" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-white">
        คอนเทนต์นี้จำกัดการเข้าถึง
      </h3>
      <p className="text-sm text-white/60 max-w-xs text-center">
        {isVip ? "สำหรับสมาชิก VIP เท่านั้น" : "กรุณาสมัครสมาชิกเพื่อดูคลิปนี้"}
      </p>
      <Button asChild className="mt-2 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-smooth">
        <Link href="/pricing">อัปเกรดเพื่อดู</Link>
      </Button>
    </div>
  );
}
