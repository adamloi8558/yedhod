import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";
import { BreadcrumbJsonLd } from "./jsonld/breadcrumb";

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const jsonLdItems = items.map((it, i) => ({
    name: it.name,
    path: it.href ?? (i === 0 ? "/" : "#"),
  }));

  return (
    <>
      <BreadcrumbJsonLd items={jsonLdItems} />
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-2 text-sm text-muted-foreground scrollbar-none"
      >
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              )}
              {it.href && !isLast ? (
                <Link
                  href={it.href}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-smooth hover:bg-muted/40 hover:text-foreground"
                >
                  {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden />}
                  <span>{it.name}</span>
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className="inline-flex items-center gap-1 max-w-[50vw] truncate text-foreground md:max-w-none"
                >
                  {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden />}
                  {it.name}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
    </>
  );
}
