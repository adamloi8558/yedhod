"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kodhom/ui/components/button";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}`, {
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
    <form onSubmit={submit} className="rounded-2xl border border-border/40 bg-card/30 p-4 space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        minLength={1}
        maxLength={4000}
        rows={4}
        placeholder="พิมพ์ข้อความ..."
        className="w-full rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-sm resize-y"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={pending} className="gradient-primary text-white">
        {pending ? "กำลังส่ง..." : "ส่งข้อความ"}
      </Button>
    </form>
  );
}
