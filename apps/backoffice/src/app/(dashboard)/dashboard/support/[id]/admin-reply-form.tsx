"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";
import { ImagePlus, X } from "lucide-react";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
    if (!body.trim() && !image) {
      setError("พิมพ์ข้อความหรือแนบรูป");
      return;
    }
    startTransition(async () => {
      try {
        const form = new FormData();
        form.append("body", body.trim());
        if (image) form.append("image", image);
        const res = await fetch(`/api/support/${ticketId}/reply`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "ส่งไม่สำเร็จ");
          return;
        }
        setBody("");
        setImage(null);
        setImagePreview(null);
        router.refresh();
      } catch {
        setError("เชื่อมต่อไม่ได้");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        rows={4}
        placeholder="ตอบกลับลูกค้า..."
        className="w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm resize-y"
      />
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
          แนบรูป
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังส่ง..." : "ตอบกลับ"}
      </Button>
    </form>
  );
}
