"use client";

import { useState } from "react";
import { Button } from "@kodhom/ui/components/button";
import { Input } from "@kodhom/ui/components/input";
import { cn } from "@kodhom/ui/lib/utils";

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function ymd(d: Date) {
  // local YYYY-MM-DD for <input type=date>
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildPreset(key: string): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  switch (key) {
    case "today":
      return { from: today, to: now, label: "วันนี้" };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const end = new Date(today);
      end.setMilliseconds(-1);
      return { from: y, to: end, label: "เมื่อวาน" };
    }
    case "7d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: f, to: now, label: "7 วัน" };
    }
    case "30d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: f, to: now, label: "30 วัน" };
    }
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
        label: "เดือนนี้",
      };
    case "year":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: now,
        label: "ปีนี้",
      };
    default:
      return buildPreset("month");
  }
}

const PRESETS = [
  { key: "today", label: "วันนี้" },
  { key: "yesterday", label: "เมื่อวาน" },
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
  { key: "month", label: "เดือนนี้" },
  { key: "year", label: "ปีนี้" },
];

export function DateRangePicker({
  value,
  activeKey,
  onChange,
}: {
  value: DateRange;
  activeKey: string;
  onChange: (range: DateRange, key: string) => void;
}) {
  const [customFrom, setCustomFrom] = useState(ymd(value.from));
  const [customTo, setCustomTo] = useState(ymd(value.to));

  function applyCustom() {
    const f = new Date(customFrom);
    const t = new Date(customTo);
    if (isNaN(f.getTime()) || isNaN(t.getTime())) return;
    onChange(
      {
        from: startOfDay(f),
        to: t,
        label: `${customFrom} → ${customTo}`,
      },
      "custom"
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={activeKey === p.key ? "default" : "outline"}
            className={cn(
              "h-8 px-3 text-xs transition-colors",
              activeKey === p.key && "shadow-sm"
            )}
            onClick={() => onChange(buildPreset(p.key), p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={customFrom}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value)}
          className="h-8 w-[140px] bg-input/50 text-xs"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value)}
          className="h-8 w-[140px] bg-input/50 text-xs"
        />
        <Button
          size="sm"
          variant={activeKey === "custom" ? "default" : "outline"}
          className="h-8 px-3 text-xs"
          onClick={applyCustom}
        >
          ใช้
        </Button>
      </div>
    </div>
  );
}
