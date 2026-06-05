"use client";

import { useState, useTransition } from "react";
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

  if (status !== "pending") {
    return slipUrl ? (
      <a
        href={slipUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ImageIcon className="h-3 w-3" />
        ดูสลิป
      </a>
    ) : null;
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
        <a
          href={slipUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ImageIcon className="h-3 w-3" />
          ดูสลิป
        </a>
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
      {error && (
        <span className="text-[11px] text-red-400">{error}</span>
      )}
    </div>
  );
}

// Touch the imported symbol so unused-var lint stays happy if the
// design moves the slip button outside this component later.
void ImageIcon;
