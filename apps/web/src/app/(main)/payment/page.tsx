"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { QRCodeSVG } from "qrcode.react";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get("planId");

  const [bankNumber, setBankNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrData, setQrData] = useState<{
    ref: string;
    qrText: string;
    amount: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");

  // Poll payment status
  useEffect(() => {
    if (!qrData?.ref) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${qrData.ref}/status`);
        const data = await res.json();
        if (data.status === "completed") {
          setPaymentStatus("completed");
          clearInterval(interval);
        } else if (data.status === "expired" || data.status === "failed") {
          setPaymentStatus(data.status);
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [qrData?.ref]);

  if (!planId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center animate-fade-in">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
            <span className="text-2xl opacity-40">⚠️</span>
          </div>
          <p className="text-muted-foreground">ข้อมูลไม่ถูกต้อง</p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricingPlanId: planId, bankNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }

      setQrData({ ref: data.ref, qrText: data.qrText, amount: data.amount });
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  if (paymentStatus === "completed") {
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
            <Button className="mt-6 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/20 transition-smooth" onClick={() => router.push("/")}>
              กลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (qrData) {
    return (
      <div className="mx-auto max-w-md p-4 animate-slide-up">
        <Card className="rounded-2xl border-border/50 overflow-hidden">
          <div className="h-1 gradient-primary" />
          <CardHeader className="text-center">
            <CardTitle className="text-lg">สแกน QR Code เพื่อชำระเงิน</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 pb-8">
            {qrData.qrText && (
              <div className="rounded-2xl bg-white p-4 shadow-lg shadow-black/10">
                <QRCodeSVG value={qrData.qrText} size={224} />
              </div>
            )}
            <p className="text-2xl font-bold gradient-text">
              {new Intl.NumberFormat("th-TH", {
                style: "currency",
                currency: "THB",
              }).format(parseFloat(qrData.amount))}
            </p>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="text-sm text-muted-foreground">
                รอการยืนยันการชำระเงิน...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 animate-fade-in">
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <div className="h-1 gradient-primary" />
        <CardHeader>
          <CardTitle className="text-lg">ชำระเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="bankNumber" className="text-sm font-medium">เลขบัญชีธนาคาร</Label>
              <Input
                id="bankNumber"
                value={bankNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setBankNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="กรอกเลขบัญชี"
                required
                className="rounded-xl bg-accent/30 border-border/50 focus:border-primary/40 focus:ring-primary/20 transition-smooth"
              />
            </div>
            <Button
              type="submit"
              className="w-full gradient-primary text-white border-0 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-smooth"
              disabled={loading || !bankNumber}
            >
              {loading ? "กำลังดำเนินการ..." : "ชำระเงิน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
