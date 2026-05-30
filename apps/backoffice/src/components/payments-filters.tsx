"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Input } from "@kodhom/ui/components/input";
import { Button } from "@kodhom/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kodhom/ui/components/select";

/**
 * URL-driven filters for /dashboard/payments. Pushes
 * ?q=&status=&from=&to=&page= so the server re-queries.
 */
export function PaymentsFilters({
  query,
  status,
  from,
  to,
  page,
  totalPages,
  total,
}: {
  query: string;
  status: string;
  from: string;
  to: string;
  page: number;
  totalPages: number;
  total: number;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);
  const [s, setS] = useState(status || "all");
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(next: { q?: string; status?: string; from?: string; to?: string; page?: number }) {
    const params = new URLSearchParams();
    const finalQ = next.q ?? q;
    const finalS = next.status ?? s;
    const finalF = next.from ?? f;
    const finalT = next.to ?? t;
    const finalPage = next.page ?? 1;
    if (finalQ) params.set("q", finalQ);
    if (finalS && finalS !== "all") params.set("status", finalS);
    if (finalF) params.set("from", finalF);
    if (finalT) params.set("to", finalT);
    if (finalPage > 1) params.set("page", String(finalPage));
    const qs = params.toString();
    router.push(qs ? `/dashboard/payments?${qs}` : "/dashboard/payments");
  }

  function reset() {
    setQ(""); setS("all"); setF(""); setT("");
    router.push("/dashboard/payments");
  }

  const hasAny = query || status || from || to;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-3 lg:flex-row lg:items-end">
        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); go({ q: q.trim(), page: 1 }); }}
          className="relative flex-1"
        >
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            ค้นหา (ชื่อ / อีเมล / อ้างอิง)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              value={q}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
              placeholder="พิมพ์เพื่อค้นหา..."
              className="h-9 bg-input/50 pl-9"
            />
          </div>
        </form>

        {/* Status */}
        <div className="lg:w-44">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            สถานะ
          </label>
          <Select value={s} onValueChange={(v) => { setS(v); go({ status: v, page: 1 }); }}>
            <SelectTrigger className="h-9 bg-input/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="completed">สำเร็จ</SelectItem>
              <SelectItem value="pending">รอชำระ</SelectItem>
              <SelectItem value="expired">หมดอายุ</SelectItem>
              <SelectItem value="failed">ล้มเหลว</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="lg:w-36">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            จากวันที่
          </label>
          <Input
            type="date"
            value={f}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setF(e.target.value)}
            onBlur={() => go({ from: f, page: 1 })}
            className="h-9 bg-input/50"
          />
        </div>
        <div className="lg:w-36">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            ถึงวันที่
          </label>
          <Input
            type="date"
            value={t}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setT(e.target.value)}
            onBlur={() => go({ to: t, page: 1 })}
            className="h-9 bg-input/50"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button size="sm" className="h-9 px-4" onClick={() => go({ q: q.trim(), from: f, to: t, page: 1 })}>
            กรอง
          </Button>
          {hasAny && (
            <Button size="sm" variant="outline" className="h-9 gap-1 px-3" onClick={reset}>
              <X className="h-4 w-4" />
              ล้าง
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total.toLocaleString()} รายการ</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1 px-3" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
              <ChevronLeft className="h-4 w-4" />
              ก่อนหน้า
            </Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-3" disabled={page >= totalPages} onClick={() => go({ page: page + 1 })}>
              ถัดไป
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
