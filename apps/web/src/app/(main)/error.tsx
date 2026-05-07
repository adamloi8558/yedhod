"use client";

import { Button } from "@kodhom/ui/components/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
          <span className="text-4xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold">เกิดข้อผิดพลาด</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ไม่สามารถโหลดเนื้อหาได้ กรุณาลองใหม่อีกครั้ง
        </p>
        <Button
          onClick={reset}
          className="mt-6 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/20"
        >
          ลองใหม่
        </Button>
      </div>
    </div>
  );
}
