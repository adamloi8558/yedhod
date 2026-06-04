import { DownloadClient } from "./download-client";
import { canonical, pageTitle, BRAND } from "@/lib/seo/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: pageTitle("ติดตั้งแอป"),
  description: `ติดตั้งแอป ${BRAND} ลงเครื่อง เปิดเร็วกว่า ใช้งานเหมือนแอป — ฟรี ไม่ต้องผ่านสโตร์`,
  alternates: canonical("/download"),
  robots: { index: true, follow: true },
};

export default function DownloadPage() {
  return <DownloadClient />;
}
