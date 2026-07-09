import Link from "next/link";
import { getPresignedDownloadUrl } from "@kodhom/r2";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories } from "@/lib/tenant-queries";
import { AdSlot } from "./ad-slot";

export async function TenantShell({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const cats = await getTenantCategories(tenant.id);
  const logo = tenant.logoR2Key
    ? await getPresignedDownloadUrl(tenant.logoR2Key, 7200)
    : null;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
<AdSlot slot="popunder" />
<AdSlot slot="header_top" />

      <header
        className="sticky top-0 z-30 border-b border-white/10 backdrop-blur"
        style={{
          background: "color-mix(in oklab, var(--tenant-bg) 85%, black)",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={tenant.name} className="h-8" />
            ) : (
              <span
                className="text-lg font-bold"
                style={{ color: "var(--tenant-primary)" }}
              >
                {tenant.name}
              </span>
            )}
          </Link>
          {tenant.tagline && (
            <span className="hidden text-sm text-white/60 md:inline">
              {tenant.tagline}
            </span>
          )}
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4 pb-3">
          <ul className="flex gap-2 whitespace-nowrap">
            <li>
              <Link
                href="/"
                className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/40"
              >
                ทั้งหมด
              </Link>
            </li>
            {cats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/40"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

<AdSlot slot="header_bottom" />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>{children}</div>
          <aside className="hidden lg:block">
            <AdSlot slot="sidebar_top" />
            <AdSlot slot="sidebar_mid" />
            <AdSlot slot="sidebar_bot" />
          </aside>
        </div>
      </main>

<AdSlot slot="footer_top" />

      <footer className="mt-12 border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          {tenant.footerText && <p className="mb-2">{tenant.footerText}</p>}
          <p>
            © {new Date().getFullYear()} {tenant.name}
          </p>
        </div>
      </footer>

<AdSlot slot="footer_bottom" />

      {/* Sticky bottom bar — mobile only */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/80 backdrop-blur md:hidden">
    <AdSlot slot="sticky_bottom" />
      </div>
    </div>
  );
}
