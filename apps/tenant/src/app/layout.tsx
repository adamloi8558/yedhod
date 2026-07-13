import "@/styles/globals.css";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

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
  try {
    const t = await getCurrentTenant();
    themeCss = `:root{--tenant-primary:${t.primaryColor};--tenant-accent:${t.accentColor};--tenant-bg:${t.backgroundColor};--tenant-fg:${t.fgColor};}`;
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
      </head>
      <body>{children}</body>
    </html>
  );
}
