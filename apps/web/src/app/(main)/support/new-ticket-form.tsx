"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { Label } from "@kodhom/ui/components/label";
import { Input } from "@kodhom/ui/components/input";
import { ImagePlus, X } from "lucide-react";

const CATEGORIES = [
  { value: "payment", label: "ปัญหาการชำระเงิน" },
  { value: "vip", label: "VIP / สิทธิ์การเข้าถึง" },
  { value: "playback", label: "ปัญหาการรับชม" },
  { value: "account", label: "บัญชี / รหัสผ่าน" },
  { value: "other", label: "อื่นๆ" },
] as const;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pickImage(file: File | null) {
    if (!file) {
      setImage(null);
      setImagePreview(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("รูปต้องไม่เกิน 4 MB");
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      setError("รองรับเฉพาะรูป JPG / PNG / GIF / WEBP");
      return;
    }
    setError(null);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.append("subject", subject.trim());
        form.append("body", body.trim());
        form.append("category", category);
        if (defaultPaymentId) form.append("paymentId", defaultPaymentId);
        if (image) form.append("image", image);

        const res = await fetch("/api/support/tickets", {
          method: "POST",
          body: form,
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
          minLength={5}
          maxLength={4000}
          rows={5}
          placeholder="อธิบายปัญหาให้ละเอียด แอดมินจะตอบกลับเร็วที่สุด"
          className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm resize-y"
          required={!image}
        />
      </div>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_MIMES.join(",")}
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        {imagePreview ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="แนบรูป"
              className="max-h-40 rounded-lg border border-border/60"
            />
            <button
              type="button"
              onClick={() => pickImage(null)}
              aria-label="ลบรูป"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-md"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <ImagePlus className="h-4 w-4" />
            แนบรูป (ไม่บังคับ)
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={pending} className="gradient-primary text-white">
        {pending ? "กำลังส่ง..." : "ส่งคำถาม"}
      </Button>
    </form>
  );
}
