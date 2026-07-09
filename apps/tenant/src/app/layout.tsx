import "@/styles/globals.css";
import { getCurrentTenant } from "@/lib/tenant";
import { getPresignedDownloadUrl } from "@kodhom/r2";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  try {
    const t = await getCurrentTenant();
    return {
      title: t.metaTitle ?? t.name,
      description: t.metaDescription ?? t.tagline ?? undefined,
      icons: t.faviconR2Key
        ? { icon: await getPresignedDownloadUrl(t.faviconR2Key, 3600) }
        : undefined,
    };
  } catch {
    return { title: "Not found" };
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
