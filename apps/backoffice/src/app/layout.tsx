import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "เย็ดโหด Backoffice",
  description: "ระบบจัดการหลังบ้าน เย็ดโหด.com",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark">
      <body className="min-h-screen font-sans antialiased selection:bg-primary/20 selection:text-primary-foreground">
        {children}
      </body>
    </html>
  );
}
