import "@/styles/globals.css";
import type { Viewport } from "next";
import Script from "next/script";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Without this, mobile browsers pretend the layout is 980px wide and
// scale the page to fit — that's what makes the site look "zoomed out"
// on phones. Setting initial-scale=1 pins the CSS pixel to a device
// pixel so responsive utilities behave as designed. Zoom stays enabled
// on purpose (accessibility + WCAG + iOS ignores user-scalable anyway).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata() {
  try {
    const t = await getCurrentTenant();
    return {
      metadataBase: new URL(`https://${t.primaryDomain}`),
      title: {
        default: t.metaTitle ?? t.name,
        template: `%s | ${t.name}`,
      },
      description: t.metaDescription ?? t.tagline ?? undefined,
      applicationName: t.name,
      // Favicon proxied through the tenant's own domain — the URL crawlers
      // and browsers see stays entirely on-brand.
      icons: t.faviconR2Key ? { icon: "/api/tenant/favicon" } : undefined,
      robots: { index: true, follow: true },
      openGraph: {
        siteName: t.name,
        locale: "th_TH",
        type: "website",
      },
    };
  } catch {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeCss = "";
  let gaId: string | null = null;
  let verificationMetas: { name: string; content: string }[] = [];
  try {
    const t = await getCurrentTenant();
    themeCss = `:root{--tenant-primary:${t.primaryColor};--tenant-accent:${t.accentColor};--tenant-bg:${t.backgroundColor};--tenant-fg:${t.fgColor};}`;
    // Only inject if it looks like a valid GA4 measurement id — the
    // validator on the backoffice side enforces the same shape, but we
    // re-check here so a hand-edited DB row can't inject arbitrary text.
    if (t.googleAnalyticsId && /^G-[A-Z0-9]{6,}$/.test(t.googleAnalyticsId)) {
      gaId = t.googleAnalyticsId;
    }
    // Re-validate the shape server-side — a hand-edited DB row could
    // otherwise put angle-brackets or quotes into the attribute and
    // escape the meta tag.
    if (Array.isArray(t.verificationMetas)) {
      verificationMetas = t.verificationMetas.filter(
        (m): m is { name: string; content: string } =>
          !!m &&
          typeof m.name === "string" &&
          typeof m.content === "string" &&
          /^[a-zA-Z0-9._:-]+$/.test(m.name) &&
          !/["'<>]/.test(m.content)
      );
    }
  } catch {
    // ignored — notFound is handled by Next.js
  }

  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {verificationMetas.map((m, i) => (
          <meta key={`${m.name}-${i}`} name={m.name} content={m.content} />
        ))}
      </head>
      <body>
        {children}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
