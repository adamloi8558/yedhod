"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Copy, Check, Upload } from "lucide-react";

interface AccountSnapshot {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

interface CreateRes {
  paymentId: string;
  account: AccountSnapshot;
  amount: string;
  expiresAt: string;
  hasSlip?: boolean;
}

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function EasySlipForm({ planId, redirect }: { planId: string; redirect?: string }) {
  const router = useRouter();
  const successHref = redirect ?? "/";
  const successLabel = redirect ? "กลับไปดูคลิป" : "กลับหน้าหลัก";
  const [phase, setPhase] = useState<"loading" | "ready" | "success">("loading");
  const [order, setOrder] = useState<CreateRes | null>(null);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [review, setReview] = useState(false);
  const [closed, setClosed] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!order || phase === "success") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/payments/${order!.paymentId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!stopped && data.status === "completed") { setPhase("success"); router.refresh(); return; }
          if (!stopped && data.status === "failed") { setClosed(true); setError("รายการนี้ถูกปฏิเสธ กรุณาติดต่อแอดมินเพื่อตรวจสอบ"); return; }
          if (!stopped && data.hasSlip) setReview(true);
        }
      } catch { /* A polling failure must not encourage a second transfer. */ }
      if (!stopped) timer = setTimeout(poll, 10_000);
    }
    timer = setTimeout(poll, 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [order, phase, router]);

  async function create(newOrder = false) {
    setCreateError("");
    try {
      const res = await fetch("/api/payments/create-easyslip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingPlanId: planId, newOrder }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "ไม่สามารถสร้างรายการได้");
        setPhase("ready"); // still go to ready so user sees error UI
        return;
      }
      setOrder(data);
      setReview(!!data.hasSlip);
      setClosed(false);
      setError("");
      setPhase("ready");
    } catch {
      setCreateError("ไม่สามารถสร้างรายการได้ กรุณาลองใหม่");
      setPhase("ready");
    }
  }

  async function copyAccount() {
    if (!order) return;
    await navigator.clipboard.writeText(order.account.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    let file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !order) return;
    setSubmitting(true);
    let sending = false;
    try {
      file = await prepareSlip(file);
      const form = new FormData();
      form.append("slip", file);
      sending = true;
      const res = await fetch(`/api/payments/${order.paymentId}/verify-slip`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ตรวจสลิปไม่สำเร็จ");
        if (data.manualReview) setReview(true);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setPhase("success");
      router.refresh();
    } catch (err) {
      setError(!sending && err instanceof Error ? err.message : "ยังยืนยันผลไม่ได้ กรุณารอตรวจสถานะหรือติดต่อแอดมิน ไม่ต้องโอนซ้ำ");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="mx-auto max-w-md p-4 text-center animate-slide-up">
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardContent className="py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-bold">ชำระเงินสำเร็จ!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              สมัครสมาชิกเรียบร้อยแล้ว คุณสามารถดูคลิปได้ทันที
            </p>
            <Button
              className="mt-6 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/20 transition-smooth"
              onClick={() => router.push(successHref)}
            >
              {successLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (createError || !order) {
    return (
      <div className="mx-auto max-w-md p-4 text-center animate-fade-in">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="py-10">
            <p className="text-base font-semibold">ไม่สามารถสร้างรายการได้</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {createError || "กรุณาลองใหม่"}
            </p>
            <Button className="mt-5" onClick={() => void create()}>
              ลองเปิดรายการอีกครั้ง
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresMs = new Date(order.expiresAt).getTime() - now;
  const expired = expiresMs <= 0;
  const mm = Math.max(0, Math.floor(expiresMs / 60_000));
  const ss = Math.max(0, Math.floor((expiresMs % 60_000) / 1000))
    .toString()
    .padStart(2, "0");


  return (
    <div className="mx-auto max-w-md p-4 animate-slide-up">
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <div className="h-1 gradient-primary" />
        <CardHeader className="text-center">
          <CardTitle className="text-lg">โอนเงินและอัปโหลดสลิป</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          {(review || expired || closed) && (
            <div role="status" className="rounded-xl border border-primary/30 p-4 text-sm space-y-2">
              <p className="font-semibold">{closed ? "รายการถูกปฏิเสธ" : review ? "บันทึกสลิปแล้ว กำลังรอผลตรวจสอบ" : "หมดเวลาโอนสำหรับรายการนี้"}</p>
              <p>หากโอนแล้ว ไม่ต้องโอนซ้ำ คุณส่งสลิปของรายการนี้หรือติดต่อแอดมินได้ ระบบจะแสดงผลเมื่ออนุมัติ</p>
              <a className="block text-primary underline" href={`/support?paymentId=${order.paymentId}&subject=${encodeURIComponent("ตรวจสอบรายการชำระเงิน")}`}>ติดต่อแอดมินพร้อมเลขรายการ</a>
              {expired && !review && !closed && <Button variant="outline" onClick={() => void create(true)}>ยังไม่ได้โอน — สร้างรายการใหม่</Button>}
              {closed && <Button variant="outline" onClick={() => void create(true)}>เปิดรายการชำระเงิน</Button>}
            </div>
          )}
          {!review && !expired && !closed && <div className="rounded-2xl border border-border/60 bg-accent/30 p-4 space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                ธนาคาร
              </p>
              <p className="text-base font-semibold">{order.account.bankName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                เลขบัญชี
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-lg font-bold tracking-wide">
                  {order.account.accountNumber}
                </p>
                <button
                  type="button"
                  onClick={copyAccount}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="คัดลอกเลขบัญชี"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                ชื่อบัญชี
              </p>
              <p className="text-sm">{order.account.accountName}</p>
            </div>
            <div className="border-t border-border/60 pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                จำนวนเงินที่ต้องโอน
              </p>
              <p className="text-2xl font-bold gradient-text">
                {new Intl.NumberFormat("th-TH", {
                  style: "currency",
                  currency: "THB",
                }).format(parseFloat(order.amount))}
              </p>
              <p className="mt-1 text-xs text-destructive">
                * ต้องโอนยอดนี้ให้ตรงเป๊ะ ไม่เช่นนั้นระบบจะไม่ตรวจผ่าน
              </p>
            </div>
            <div className="rounded-lg bg-background/50 px-3 py-2 text-center text-xs text-muted-foreground">
              เหลือเวลา {mm}:{ss} นาที
            </div>
          </div>}

          <p className="text-xs text-muted-foreground">เลขรายการ: {order.paymentId} · ยอด {order.amount} บาท</p>
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <p>{error}</p>
              <a
                href={`/support?paymentId=${order.paymentId}&subject=${encodeURIComponent("สลิปไม่ผ่านระบบ")}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                แจ้งปัญหากับแอดมิน →
              </a>
            </div>
          )}

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handleFile}
              className="hidden"
              id="slip-upload"
              disabled={submitting || closed}
            />
            <label
              htmlFor="slip-upload"
              className={
                "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 px-4 py-6 text-sm font-medium transition-colors " +
                (submitting
                  ? "pointer-events-none opacity-60"
                  : "hover:border-primary/40 hover:bg-accent/30")
              }
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  กำลังตรวจสอบสลิป...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  {review ? "ส่งสลิปเพื่อตรวจอีกครั้ง" : "อัปโหลดสลิปการโอน"}
                </>
              )}
            </label>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              รับภาพไม่เกิน 20 MB และย่อภาพก่อนส่ง หากเปิดรูปไม่ได้ให้ใช้ภาพหน้าจอสลิปที่เห็น QR ชัดเจน
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function prepareSlip(file: File): Promise<File> {
  if (!file.size) throw new Error("ไฟล์ว่าง กรุณาเลือกรูปสลิปใหม่");
  if (file.size > 20 * 1024 * 1024) throw new Error("รูปใหญ่เกิน 20 MB กรุณาใช้ภาพหน้าจอสลิป");
  if (file.size <= MAX_BYTES && (ALLOWED.includes(file.type) || (!file.type && /\.(jpe?g|png|gif|webp)$/i.test(file.name)))) return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("อุปกรณ์นี้เปิดรูปไม่ได้ กรุณาใช้ภาพหน้าจอสลิปหรือบันทึกเป็น JPG/PNG"); }
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เตรียมรูปไม่ได้ กรุณาใช้ภาพหน้าจอสลิป");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || blob.size > MAX_BYTES) throw new Error("ย่อรูปไม่ได้ กรุณาใช้ภาพหน้าจอสลิปที่เห็น QR ชัดเจน");
    return new File([blob], "slip.jpg", { type: "image/jpeg" });
  } finally { bitmap.close(); }
}
