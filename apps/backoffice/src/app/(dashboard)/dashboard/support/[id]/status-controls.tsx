"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "open", label: "รอตอบ" },
  { value: "in_progress", label: "กำลังดำเนินการ" },
  { value: "resolved", label: "แก้ไขแล้ว" },
  { value: "closed", label: "ปิด" },
] as const;

export function TicketStatusControls({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(next: string) {
    if (next === status) return;
    startTransition(async () => {
      try {
        await fetch(`/api/support/${ticketId}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        router.refresh();
      } catch {
        // ignore
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">สถานะ:</span>
      {STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={pending}
          onClick={() => setStatus(s.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
            status === s.value
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
