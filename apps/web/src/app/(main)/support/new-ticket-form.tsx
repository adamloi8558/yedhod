"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Label } from "@kodhom/ui/components/label";
import { Input } from "@kodhom/ui/components/input";

const CATEGORIES = [
  { value: "payment", label: "ปัญหาการชำระเงิน" },
  { value: "vip", label: "VIP / สิทธิ์การเข้าถึง" },
  { value: "playback", label: "ปัญหาการรับชม" },
  { value: "account", label: "บัญชี / รหัสผ่าน" },
  { value: "other", label: "อื่นๆ" },
] as const;

export function NewTicketForm({
  defaultPaymentId,
  defaultSubject,
}: {
  defaultPaymentId: string;
  defaultSubject: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(
    defaultPaymentId ? "payment" : "other"
  );
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/support/tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            category,
            subject: subject.trim(),
            body: body.trim(),
            paymentId: defaultPaymentId || undefined,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "ส่งไม่สำเร็จ");
          return;
        }
        const j = await res.json();
        router.push(`/support/${j.ticketId}`);
      } catch {
        setError("เชื่อมต่อไม่ได้");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="cat" className="text-xs text-muted-foreground">
          หมวด
        </Label>
        <select
          id="cat"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="subj" className="text-xs text-muted-foreground">
          หัวข้อ
        </Label>
        <Input
          id="subj"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="เช่น สลิปไม่ผ่านระบบ"
          maxLength={200}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="body" className="text-xs text-muted-foreground">
          รายละเอียด
        </Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={5}
          maxLength={4000}
          rows={5}
          placeholder="อธิบายปัญหาให้ละเอียด แอดมินจะตอบกลับเร็วที่สุด"
          className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={pending} className="gradient-primary text-white">
        {pending ? "กำลังส่ง..." : "ส่งคำถาม"}
      </Button>
    </form>
  );
}
