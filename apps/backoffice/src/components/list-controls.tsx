"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@kodhom/ui/components/input";
import { Button } from "@kodhom/ui/components/button";

/**
 * Server-driven search + pagination control. Pushes ?q= and ?page= so the
 * server component re-queries with limit/offset — keeps big tables (clips,
 * users) from rendering thousands of rows at once.
 */
export function ListControls({
  basePath,
  query,
  page,
  totalPages,
  placeholder = "ค้นหา...",
  pagerOnly = false,
}: {
  basePath: string;
  query: string;
  page: number;
  totalPages: number;
  placeholder?: string;
  pagerOnly?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(query);

  function go(nextPage: number, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    go(1, value.trim());
  }

  const pager = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1 px-3"
        disabled={page <= 1}
        onClick={() => go(page - 1, query)}
      >
        <ChevronLeft className="h-4 w-4" />
        ก่อนหน้า
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1 px-3"
        disabled={page >= totalPages}
        onClick={() => go(page + 1, query)}
      >
        ถัดไป
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  if (pagerOnly) {
    return totalPages > 1 ? <div className="mt-4 flex justify-center">{pager}</div> : null;
  }

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={submitSearch} className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-9 bg-input/50 pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setValue(""); go(1, ""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            ล้าง
          </button>
        )}
      </form>
      {totalPages > 1 && pager}
    </div>
  );
}
