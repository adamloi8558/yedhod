"use client";

import { useEffect, useState } from "react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { Label } from "@kodhom/ui/components/label";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Plus, Trash2 } from "lucide-react";

type Provider = "anypay" | "easyslip";

interface PaymentAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  weight: number;
  isActive: boolean;
}

function nanoLocal() {
  return Math.random().toString(36).slice(2, 12);
}

export default function PaymentConfigPage() {
  const [provider, setProvider] = useState<Provider>("anypay");
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [savingAccs, setSavingAccs] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/payment-config")
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.payment_mode?.provider ?? "anypay");
        setHasApiKey(Boolean(d.easyslip_config?.hasApiKey));
        setAccounts(Array.isArray(d.payment_accounts) ? d.payment_accounts : []);
      })
      .finally(() => setLoading(false));
  }, []);

  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  async function saveMode(p: Provider) {
    setSavingMode(true);
    setProvider(p);
    const res = await fetch("/api/payment-config/mode", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p }),
    });
    setSavingMode(false);
    if (res.ok) flash("ok", "บันทึกโหมดเรียบร้อย");
    else flash("err", "บันทึกไม่สำเร็จ");
  }

  async function saveApiKey() {
    setSavingKey(true);
    const res = await fetch("/api/payment-config/easyslip", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    setSavingKey(false);
    if (res.ok) {
      flash("ok", "บันทึก API Key เรียบร้อย");
      setApiKey("");
      setHasApiKey(true);
    } else {
      flash("err", "บันทึกไม่สำเร็จ");
    }
  }

  async function saveAccounts() {
    setSavingAccs(true);
    const res = await fetch("/api/payment-config/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accounts),
    });
    const data = await res.json();
    setSavingAccs(false);
    if (res.ok) flash("ok", "บันทึกบัญชีเรียบร้อย");
    else flash("err", data.error ?? "บันทึกไม่สำเร็จ");
  }

  function addRow() {
    setAccounts((prev) => [
      ...prev,
      {
        id: nanoLocal(),
        bankCode: "",
        bankName: "",
        accountNumber: "",
        accountName: "",
        weight: 0,
        isActive: true,
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<PaymentAccount>) {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }

  function removeRow(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  const activeWeightSum = accounts
    .filter((a) => a.isActive)
    .reduce((s, a) => s + (Number(a.weight) || 0), 0);
  const sumOk = activeWeightSum === 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          ช่องทางชำระเงิน
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ตั้งค่าผู้ให้บริการและบัญชีรับเงิน
        </p>
      </div>

      {msg && (
        <div
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (msg.type === "ok"
              ? "bg-green-500/10 text-green-600"
              : "bg-destructive/10 text-destructive")
          }
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <>
          {/* Section 1: Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">โหมดการชำระเงิน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                เลือกผู้ให้บริการที่ใช้งานอยู่ — ลูกค้าทุกคนจะใช้โหมดนี้
              </p>
              <div className="flex gap-3">
                <ProviderRadio
                  label="AnyPay (QR Auto)"
                  selected={provider === "anypay"}
                  disabled={savingMode}
                  onClick={() => saveMode("anypay")}
                />
                <ProviderRadio
                  label="EasySlip (โอน + ตรวจสลิป)"
                  selected={provider === "easyslip"}
                  disabled={savingMode}
                  onClick={() => saveMode("easyslip")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: EasySlip API key (write-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">EasySlip API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                จาก dashboard ของ EasySlip ระบบจะเก็บไว้ปลอดภัย ไม่แสดงค่ากลับ
                — กรอกเฉพาะตอนต้องการตั้งใหม่
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-3 py-2 text-xs">
                <span
                  className={
                    "inline-block h-2 w-2 rounded-full " +
                    (hasApiKey ? "bg-green-500" : "bg-muted-foreground/40")
                  }
                />
                {hasApiKey ? "ตั้งค่า API Key แล้ว" : "ยังไม่ได้ตั้งค่า"}
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setApiKey(e.target.value)
                  }
                  placeholder={hasApiKey ? "ตั้งค่าใหม่ทับของเดิม" : "วาง API Key"}
                  autoComplete="new-password"
                  className="flex-1"
                />
                <Button onClick={saveApiKey} disabled={savingKey || !apiKey}>
                  {savingKey ? "กำลังบันทึก..." : "บันทึก"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Payment accounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">บัญชีรับเงิน</CardTitle>
              <span
                className={
                  "text-xs font-medium " +
                  (sumOk ? "text-green-600" : "text-destructive")
                }
              >
                รวมน้ำหนัก: {activeWeightSum}/100
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                ระบบจะสุ่มเลือกบัญชีให้ลูกค้าตามน้ำหนัก (%) ของแต่ละบัญชี —
                น้ำหนักรวมของบัญชีที่ใช้งานต้องเท่ากับ 100
              </p>

              <div className="space-y-3">
                {accounts.map((a, idx) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    {/* Row header: title + active toggle + delete */}
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        บัญชี #{idx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={a.isActive}
                            onChange={(e) =>
                              updateRow(a.id, { isActive: e.target.checked })
                            }
                          />
                          ใช้งาน
                        </label>
                        <button
                          onClick={() => removeRow(a.id)}
                          className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="ลบบัญชี"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Fields: stack on mobile, fluid grid on larger screens */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="col-span-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          รหัส
                        </Label>
                        <Input
                          value={a.bankCode}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(a.id, {
                              bankCode: e.target.value.replace(/\D/g, "").slice(0, 3),
                            })
                          }
                          placeholder="004"
                          className="mt-1 font-mono text-sm"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-2 lg:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          ธนาคาร
                        </Label>
                        <Input
                          value={a.bankName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(a.id, { bankName: e.target.value })
                          }
                          placeholder="กสิกรไทย"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-3 lg:col-span-3">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          เลขบัญชี
                        </Label>
                        <Input
                          value={a.accountNumber}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(a.id, {
                              accountNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          placeholder="1234567890"
                          className="mt-1 font-mono text-sm"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-2 lg:col-span-4">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          ชื่อบัญชี
                        </Label>
                        <Input
                          value={a.accountName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(a.id, { accountName: e.target.value })
                          }
                          placeholder="นายสมชาย ใจดี"
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          น้ำหนัก (%)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={a.weight}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateRow(a.id, {
                              weight: Math.max(
                                0,
                                Math.min(100, parseInt(e.target.value || "0", 10))
                              ),
                            })
                          }
                          className="mt-1 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
                  <Plus className="h-4 w-4" />
                  เพิ่มบัญชี
                </Button>
                <Button
                  onClick={saveAccounts}
                  disabled={savingAccs || !sumOk}
                  className="ml-auto"
                >
                  {savingAccs ? "กำลังบันทึก..." : "บันทึกบัญชี"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ProviderRadio({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex flex-1 items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all " +
        (selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border/60 text-muted-foreground hover:border-border")
      }
    >
      <span
        className={
          "h-3.5 w-3.5 rounded-full border-2 " +
          (selected ? "border-primary bg-primary" : "border-muted-foreground/40")
        }
      />
      {label}
    </button>
  );
}
