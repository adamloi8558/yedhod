"use client";

import * as React from "react";
import { cn } from "@kodhom/ui/lib/utils";

/**
 * Responsive list rendering for admin tables.
 *
 * On md+ screens render the normal <table> (pass it as `table`).
 * On mobile (below md) render each row as a stacked card so NO column
 * is hidden. Use <MobileCards> with <MobileCard> + <MobileField> for the
 * mobile view. Colors/spacing reuse existing tokens — no new palette.
 *
 * Usage:
 *   <ResponsiveTable
 *     table={<table className="admin-table">...</table>}
 *     mobile={
 *       <MobileCards>
 *         {rows.map((r) => (
 *           <MobileCard key={r.id} title={r.name} actions={<...>}>
 *             <MobileField label="ราคา" value={...} />
 *             ...
 *           </MobileCard>
 *         ))}
 *       </MobileCards>
 *     }
 *   />
 */
export function ResponsiveTable({
  table,
  mobile,
}: {
  table: React.ReactNode;
  mobile: React.ReactNode;
}) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-xl border border-border/50 bg-card/50 md:block">
        <div className="overflow-x-auto">{table}</div>
      </div>
      {/* Mobile stacked cards */}
      <div className="md:hidden">{mobile}</div>
    </>
  );
}

export function MobileCards({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

export function MobileCard({
  title,
  badge,
  actions,
  children,
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{title}</span>
            {badge}
          </div>
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>
      {children && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {children}
        </dl>
      )}
    </div>
  );
}

export function MobileField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
