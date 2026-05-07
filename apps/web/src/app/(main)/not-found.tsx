import Link from "next/link";
import { Button } from "@kodhom/ui/components/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 animate-fade-in">
      <div className="text-center max-w-md">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
          <span className="text-4xl opacity-50">🔍</span>
        </div>
        <h1 className="text-xl font-bold">ไม่พบหน้าที่คุณค้นหา</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          หน้านี้อาจถูกย้าย ถูกลบ หรือพิมพ์ลิงก์ผิด
        </p>
        <Button
          asChild
          className="mt-6 gradient-primary text-white border-0 rounded-xl px-8 shadow-lg shadow-primary/20"
        >
          <Link href="/">กลับหน้าหลัก</Link>
        </Button>
      </div>
    </div>
  );
}
