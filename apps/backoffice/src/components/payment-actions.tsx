"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Image as ImageIcon } from "lucide-react";

interface Props {
  paymentId: string;
  status: string;
  hasSlip: boolean;
  slipUrl?: string | null;
  provider?: string;
}

interface ExistingSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  amountPaid: string | null;
}

export function PaymentActions({ paymentId, status, hasSlip, slipUrl, provider }: Props) {
  const router = useRouter();
  const formId = useId();
  const transRefInput = useRef<HTMLInputElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const [transRef, setTransRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [linkId, setLinkId] = useState("");
  const [existingSubscriptions, setExistingSubscriptions] = useState<ExistingSubscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState(false);
  const [retrySubscriptions, setRetrySubscriptions] = useState(0);
  const [approveOpen, setApproveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);

  useEffect(() => {
    if (!approveOpen || status !== "pending") return;
    const controller = new AbortController();
    setLoadingSubscriptions(true);
    setSubscriptionsError(false);
    async function loadSubscriptions() {
      try {
        const res = await fetch(`/api/payments/${paymentId}/approve`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        if (!res.ok) throw new Error("Unable to load subscriptions");
        const data = await res.json();
        if (!Array.isArray(data.existingSubscriptions)) throw new Error("Invalid subscriptions response");
        if (!controller.signal.aborted) setExistingSubscriptions(data.existingSubscriptions);
      } catch {
        if (!controller.signal.aborted) setSubscriptionsError(true);
      } finally {
        if (!controller.signal.aborted) setLoadingSubscriptions(false);
      }
    }
    void loadSubscriptions();
    return () => controller.abort();
  }, [approveOpen, paymentId, status, retrySubscriptions]);

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
    if (!approveOpen) { setError(null); setConfirmingReject(false); setApproveOpen(true); return; }
    setError(null);
    if (provider === "easyslip") {
      if (!hasSlip) { setError("ยังไม่มีสลิป กรุณาให้ลูกค้าส่งสลิปก่อนอนุมัติ"); return; }
      if (!/^[a-zA-Z0-9._:/-]{6,200}$/.test(transRef.trim())) {
        setError("กรุณากรอกเลขธุรกรรมจากสลิป 6–200 ตัว ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ . _ : / -");
        transRefInput.current?.focus();
        return;
      }
      if (!confirmed) {
        setError("กรุณาติ๊กยืนยันหลังตรวจยอดเงิน บัญชีรับ และเงินเข้าจริงแล้ว");
        confirmationInput.current?.focus();
        return;
      }
    }
    if (loadingSubscriptions || subscriptionsError) {
      setError("กรุณารอโหลดสิทธิ์เดิมให้สำเร็จก่อนยืนยัน เพื่อป้องกันการเพิ่ม VIP ซ้ำ");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transRef: transRef.trim(), confirmed, existingSubscriptionId: linkId || undefined }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "อนุมัติไม่สำเร็จ");
          if (j.existingSubscriptionId) setRetrySubscriptions((n) => n + 1);
          return;
        }
        router.refresh();
      } catch {
        setError("ยังยืนยันผลไม่ได้ กรุณารีเฟรชรายการเพื่อตรวจสถานะก่อนลองอีกครั้ง");
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
      {approveOpen && <div className="w-full min-w-64 space-y-3 rounded border border-border p-3 text-xs">
        {provider === "easyslip" && <>
          <div className="space-y-1">
            <label htmlFor={`${formId}-reference`} className="block font-medium">เลขธุรกรรมธนาคาร (จำเป็น)</label>
            <input id={`${formId}-reference`} ref={transRefInput} aria-label="เลขธุรกรรมธนาคาร" aria-describedby={`${formId}-reference-help`} placeholder="เลขอ้างอิงการโอนจากสลิป" value={transRef} onChange={(e) => setTransRef(e.target.value)} disabled={pending} maxLength={200} className="w-full rounded border bg-background p-2" />
            <p id={`${formId}-reference-help`} className="text-muted-foreground">เปิดดูสลิป แล้วกรอกเลขธุรกรรมหรือเลขอ้างอิงการโอนที่ธนาคารออกให้</p>
          </div>
          <label className="flex cursor-pointer items-start gap-2"><input ref={confirmationInput} type="checkbox" checked={confirmed} disabled={pending} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />ตรวจยอดเงิน บัญชีรับ และยืนยันเงินเข้าแล้ว</label>
          {!hasSlip && <p className="text-red-400">ยังไม่มีสลิป กรุณาให้ลูกค้าส่งสลิปก่อนอนุมัติ</p>}
        </>}
        {loadingSubscriptions ? <p role="status" className="text-muted-foreground">กำลังตรวจสิทธิ์ VIP เดิม…</p> : subscriptionsError ? (
          <div role="alert" className="space-y-1 text-red-400">
            <p>โหลดสิทธิ์เดิมไม่สำเร็จ กรุณาลองอีกครั้ง</p>
            <button type="button" onClick={() => setRetrySubscriptions((n) => n + 1)} className="underline">โหลดสิทธิ์เดิมอีกครั้ง</button>
          </div>
        ) : existingSubscriptions.length > 0 ? (
          <div className="space-y-1">
            <label htmlFor={`${formId}-subscription`} className="block font-medium">เคยเพิ่ม VIP สำหรับยอดนี้แล้วหรือไม่?</label>
            <select id={`${formId}-subscription`} value={linkId} onChange={(e) => setLinkId(e.target.value)} disabled={pending} className="w-full rounded border bg-background p-2">
              <option value="">ยังไม่ได้เพิ่ม — สร้างสิทธิ์ใหม่</option>
              {existingSubscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  ใช้สิทธิ์เดิม: {new Date(subscription.startDate).toLocaleString("th-TH")} · {subscription.amountPaid ? `฿${subscription.amountPaid}` : "ไม่ระบุยอด"} · {subscription.endDate ? `ถึง ${new Date(subscription.endDate).toLocaleDateString("th-TH")}` : "ตลอดชีพ"}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground">เลือกสิทธิ์ที่เคยเพิ่มให้ยอดนี้เพื่อปิดรายการ โดยไม่เพิ่มวัน VIP ซ้ำ</p>
          </div>
        ) : <p className="text-muted-foreground">ไม่พบสิทธิ์ที่แอดมินเพิ่มไว้สำหรับแพ็กเกจนี้หลังสร้างรายการ อนุมัติแล้วจะสร้างสิทธิ์ใหม่</p>}
      </div>}
      <button
        type="button"
        onClick={approve}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-60"
      >
        <Check className="h-3 w-3" />
        {pending ? "กำลังบันทึก…" : approveOpen ? (linkId ? "ยืนยันผูกสิทธิ์เดิม" : "ยืนยันอนุมัติ") : "อนุมัติ"}
      </button>
      {approveOpen && <button type="button" disabled={pending} onClick={() => { setApproveOpen(false); setError(null); }} className="text-[11px] text-muted-foreground hover:text-foreground">ยกเลิกอนุมัติ</button>}
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
      {error && <p role="alert" className="w-full text-xs text-red-400">{error}</p>}
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
