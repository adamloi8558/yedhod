"use client";

import { useState } from "react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";

const BANKS = [
  { code: "002", name: "ธนาคารกรุงเทพ (BBL)" },
  { code: "004", name: "ธนาคารกสิกรไทย (KBANK)" },
  { code: "006", name: "ธนาคารกรุงไทย (KTB)" },
  { code: "011", name: "ธนาคารทหารไทยธนชาต (TTB)" },
  { code: "014", name: "ธนาคารไทยพาณิชย์ (SCB)" },
  { code: "025", name: "ธนาคารกรุงศรีอยุธยา (BAY)" },
  { code: "030", name: "ธนาคารออมสิน (GSB)" },
  { code: "034", name: "ธนาคารเพื่อการเกษตร (BAAC)" },
];

export default function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [bankNumber, setBankNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, bankNumber, bankCode }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: `ถอนเงินสำเร็จ ref: ${data.ref ?? data.id ?? "OK"}` });
        setAmount("");
        setBankNumber("");
        setBankCode("");
      } else {
        setResult({ success: false, message: data.error ?? "เกิดข้อผิดพลาด" });
      }
    } catch {
      setResult({ success: false, message: "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">ถอนเงิน (AnyPay)</h1>
        <p className="mt-1 text-sm text-muted-foreground">Withdrawals</p>
      </div>

      <Card className="max-w-md border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">สร้างรายการถอนเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {result && (
              <div
                className={`animate-slide-up rounded-lg border px-4 py-3 text-sm ${
                  result.success
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-destructive/20 bg-destructive/10 text-destructive"
                }`}
              >
                {result.message}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">จำนวนเงิน (บาท)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="bg-input/50 pr-12 tabular-nums transition-colors focus:bg-input"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">THB</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">เลขบัญชีธนาคาร</Label>
              <Input
                value={bankNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="กรอกเลขบัญชี"
                required
                className="bg-input/50 tabular-nums tracking-wider transition-colors focus:bg-input"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">ธนาคาร</Label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger className="bg-input/50">
                  <SelectValue placeholder="เลือกธนาคาร" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="h-10 w-full font-medium transition-all duration-200 hover:shadow-lg hover:shadow-primary/20" disabled={loading || !bankCode}>
              {loading ? "กำลังดำเนินการ..." : "ถอนเงิน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
