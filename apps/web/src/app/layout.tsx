import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/lib/sidebar-store";
import { HeaderWrapper } from "@/components/header-wrapper";
import { Analytics } from "@/components/analytics";
import { PWARegister } from "@/components/pwa-register";
import {
  SITE_URL,
  BRAND,
  BRAND_TAGLINE,
  adultMetaOther,
} from "@/lib/seo/metadata";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND} - ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND}`,
  },
  description: `${BRAND} รวมคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง อัปเดตใหม่ทุกวัน ดูได้ทุกที่ทุกเวลา สมาชิก VIP ดูไม่จำกัด ปลอดภัย สำหรับผู้มีอายุ 18 ปีขึ้นไป`,
  applicationName: BRAND,
  keywords: [BRAND, "คลิป", "คลิปวิดีโอ", "วิดีโอผู้ใหญ่", "18+", "VIP"],
  alternates: {
    canonical: "/",
    languages: {
      "th-TH": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: BRAND,
    url: SITE_URL,
    title: `${BRAND} - ${BRAND_TAGLINE}`,
    description: `${BRAND} รวมคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง อัปเดตใหม่ทุกวัน สำหรับผู้มีอายุ 18 ปีขึ้นไป`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} - ${BRAND_TAGLINE}`,
    description: `รวมคลิปวิดีโอผู้ใหญ่ไทยคุณภาพสูง อัปเดตใหม่ทุกวัน สำหรับผู้มีอายุ 18 ปีขึ้นไป`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "4_S0HkzgexgmrG7P0gofWle4J52v1U1zyDr6f-HvmqM",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND,
    statusBarStyle: "black-translucent",
  },
  other: {
    ...adultMetaOther(),
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
        >
          ข้ามไปยังเนื้อหาหลัก
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <div className="flex h-screen flex-col bg-background">
              <HeaderWrapper />
              {children}
            </div>
          </SidebarProvider>
        </ThemeProvider>
        <Analytics />
        <PWARegister />
      </body>
    </html>
  );
}
