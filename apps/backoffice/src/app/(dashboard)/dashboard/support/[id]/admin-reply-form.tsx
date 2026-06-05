"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/support/${ticketId}/reply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "ส่งไม่สำเร็จ");
          return;
        }
        setBody("");
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
        required
        minLength={1}
        maxLength={4000}
        rows={4}
        placeholder="ตอบกลับลูกค้า..."
        className="w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm resize-y"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังส่ง..." : "ตอบกลับ"}
      </Button>
    </form>
  );
}
