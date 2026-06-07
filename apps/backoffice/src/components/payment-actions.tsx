"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Image as ImageIcon } from "lucide-react";

interface Props {
  paymentId: string;
  status: string;
  hasSlip: boolean;
  slipUrl?: string | null;
}

export function PaymentActions({ paymentId, status, hasSlip, slipUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    if (!slipOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSlipOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [slipOpen]);

  if (status !== "pending") {
    return (
      <>
        {slipUrl && (
          <button
            type="button"
            onClick={() => setSlipOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImageIcon className="h-3 w-3" />
            ดูสลิป
          </button>
        )}
        {slipOpen && slipUrl && (
          <SlipModal url={slipUrl} onClose={() => setSlipOpen(false)} />
        )}
      </>
    );
  }

  async function approve() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/approve`, {
          method: "POST",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "อนุมัติไม่สำเร็จ");
          return;
        }
        router.refresh();
      } catch {
        setError("เชื่อมต่อไม่ได้");
      }
    });
  }

  async function reject() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/reject`, {
          method: "POST",
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "ปฏิเสธไม่สำเร็จ");
          return;
        }
        router.refresh();
      } catch {
        setError("เชื่อมต่อไม่ได้");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {slipUrl && (
        <button
          type="button"
          onClick={() => setSlipOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ImageIcon className="h-3 w-3" />
          ดูสลิป
        </button>
      )}
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
      >
        <Check className="h-3 w-3" />
        อนุมัติ
      </button>
      {confirmingReject ? (
        <>
          <button
            type="button"
            onClick={reject}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-red-500/20 px-2 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-60"
          >
            ยืนยันปฏิเสธ
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReject(false)}
            disabled={pending}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            ยกเลิก
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingReject(true)}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60"
        >
          <X className="h-3 w-3" />
          ปฏิเสธ
        </button>
      )}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      {slipOpen && slipUrl && (
        <SlipModal url={slipUrl} onClose={() => setSlipOpen(false)} />
      )}
    </div>
  );
}

function SlipModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ดูสลิป"
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] max-w-3xl overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2">
          <span className="text-sm font-semibold text-foreground">สลิปการโอน</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* The slip URL is an API route that 302s to a 60s presigned R2
            URL. <img src> follows the redirect, so the actual signed URL
            never lands in the DOM where someone could copy it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="สลิป"
          className="block max-h-[80vh] w-auto max-w-full bg-black"
        />
      </div>
    </div>
  );
}
