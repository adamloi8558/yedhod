"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@kodhom/ui/components/input";
import { Button } from "@kodhom/ui/components/button";

/**
 * On-page search box for /search. Lets the page be searched from anywhere
 * (bottom nav, a direct link, refresh) without relying on the header — it
 * prefills from the current query and pushes ?q= on submit.
 */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          autoFocus
          placeholder="ค้นหาคลิป..."
          className="pl-9 bg-accent/50 border-border/50 focus:bg-accent focus:border-primary/40 focus:ring-primary/20 transition-smooth rounded-xl"
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setValue(e.target.value)
          }
        />
      </div>
      <Button type="submit" className="gradient-primary text-white border-0 rounded-xl px-5">
        ค้นหา
      </Button>
    </form>
  );
}
