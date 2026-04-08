"use client";

import { useSidebarStore } from "@/lib/sidebar-store";
import { Sidebar } from "./sidebar";
import { X } from "lucide-react";
import { Button } from "@kodhom/ui/components/button";

interface MobileSidebarProps {
  categories: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    coverImage: string | null;
  }[];
}

export function MobileSidebar({ categories }: MobileSidebarProps) {
  const { isOpen, close } = useSidebarStore();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
        onClick={close}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-80 border-r border-border/50 glass-strong md:hidden animate-slide-in-left shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
          <span className="font-semibold text-lg gradient-text">หมวดหมู่</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            className="rounded-xl hover:bg-accent/80 transition-smooth"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <Sidebar categories={categories} />
      </div>
    </>
  );
}
