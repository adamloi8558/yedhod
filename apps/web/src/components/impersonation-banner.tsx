"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

/**
 * Sticky banner shown on the public web when the current session was
 * created via Better Auth's impersonateUser. Lets the admin exit back
 * to their own session in one click.
 */
export function ImpersonationBanner({ asUserName }: { asUserName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function stop() {
    setBusy(true);
    try {
      const res = await fetch("/api/impersonate/stop", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "stop ไม่สำเร็จ");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm text-black">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4" />
        <span>
          🛑 กำลังดูในฐานะ <strong>{asUserName}</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={stop}
        disabled={busy}
        className="rounded-md bg-black/20 px-3 py-1 text-xs font-semibold hover:bg-black/30 disabled:opacity-50"
      >
        {busy ? "กำลังออก..." : "Stop impersonating"}
      </button>
    </div>
  );
}
