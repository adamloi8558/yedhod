"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { ScrollArea } from "@kodhom/ui/components/scroll-area";
import { cn } from "@kodhom/ui/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  childCount?: number;
}

interface SidebarProps {
  categories: Category[];
}

export function Sidebar({ categories }: SidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const activeSlug = params?.slug as string | undefined;
  const onAllCategories = pathname === "/categories";

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-0.5">
        <Link
          href="/"
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-smooth hover:bg-accent/70",
            pathname === "/" && "bg-accent text-accent-foreground"
          )}
        >
          {pathname === "/" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary glow-primary" />
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm transition-smooth group-hover:bg-primary/15">
            ALL
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">ทั้งหมด</p>
            <p className="text-xs text-muted-foreground truncate">ดูคลิปทุกหมวดหมู่</p>
          </div>
        </Link>

        {/* Separator */}
        <div className="mx-3 my-2 h-px bg-border/50" />

        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={
              (cat.childCount ?? 0) > 0
                ? `/categories/${cat.slug}`
                : `/category/${cat.slug}`
            }
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-smooth hover:bg-accent/70",
              activeSlug === cat.slug && "bg-accent text-accent-foreground"
            )}
          >
            {activeSlug === cat.slug && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary glow-primary" />
            )}
            {cat.coverImage ? (
              <img
                src={cat.coverImage}
                alt=""
                className="h-10 w-10 rounded-xl object-cover transition-smooth group-hover:scale-105"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-bold text-sm transition-smooth group-hover:bg-secondary/80">
                {cat.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{cat.name}</p>
              {cat.description && (
                <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
              )}
            </div>
          </Link>
        ))}

        {/* See all categories */}
        <div className="mx-3 my-2 h-px bg-border/50" />
        <Link
          href="/categories"
          className={cn(
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-smooth hover:bg-accent/70",
            onAllCategories && "bg-accent text-accent-foreground"
          )}
        >
          {onAllCategories && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary glow-primary" />
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-smooth group-hover:bg-primary/15">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <span className="flex-1">ดูทุกหมวดหมู่</span>
        </Link>
      </div>
    </ScrollArea>
  );
}
