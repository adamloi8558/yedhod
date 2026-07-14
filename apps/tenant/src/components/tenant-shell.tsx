import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories, getTenantAds } from "@/lib/tenant-queries";
import { AdSlot } from "./ad-slot";

export async function TenantShell({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const cats = await getTenantCategories(tenant.id);
  // Logo goes through /api/tenant/logo so <img src> stays on this domain.
  const logo = tenant.logoR2Key ? "/api/tenant/logo" : null;

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <AdSlot slot="popunder" />
      <div className="mx-auto w-full max-w-[1400px] px-4">
        <AdSlot slot="header_top" />
      </div>

      {/* Top bar — dark, thin, brand-forward like pornhub */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "#000",
          borderColor: "var(--tenant-border)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
          <Link href="/" className="flex shrink-0 items-center">
            {logo ? (
              <img src={logo} alt={tenant.name} className="h-7" />
            ) : (
              <span className="text-xl font-black tracking-tight">
                <span className="text-white">{tenant.name.slice(0, Math.ceil(tenant.name.length / 2))}</span>
                <span
                  className="rounded px-1 text-black"
                  style={{ background: "var(--tenant-primary)" }}
                >
                  {tenant.name.slice(Math.ceil(tenant.name.length / 2))}
                </span>
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white hover:text-[color:var(--tenant-primary)]"
            >
              หน้าแรก
            </Link>
            <Link
              href="/all"
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-white/70 hover:text-[color:var(--tenant-primary)]"
            >
              คลิปทั้งหมด
            </Link>
          </nav>

          <div className="flex-1" />

          <span className="hidden text-xs text-white/40 md:inline">
            🔞 18+ Adults Only
          </span>
        </div>

        {/* Category strip */}
        {cats.length > 0 && (
          <div
            className="border-t"
            style={{
              borderColor: "var(--tenant-border)",
              background: "var(--tenant-panel)",
            }}
          >
            <div className="mx-auto max-w-[1400px] px-4">
              <nav className="strip-scroll overflow-x-auto">
                <ul className="flex items-center gap-1 whitespace-nowrap py-2">
                  <li>
                    <Link
                      href="/"
                      className="rounded px-3 py-1.5 text-sm font-semibold text-black"
                      style={{ background: "var(--tenant-primary)" }}
                    >
                      แนะนำ
                    </Link>
                  </li>
                  {cats.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/category/${c.slug}`}
                        className="rounded px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4">
        <AdSlot slot="catbar_below" />
        <AdSlot slot="header_bottom" />
        <AdSlot slot="hero_below" />
      </div>

      {/* 2-column shell on lg+: content on the left, sticky ad rail on
       * the right. On smaller screens the aside collapses and sidebar
       * ads fall to the end of the page (same as before). The rail is
       * fixed-width (300px) so 300x250 / 300x600 zones land flush. */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_312px] lg:gap-6">
          <div className="min-w-0">{children}</div>
          <aside className="mt-10 hidden lg:mt-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <AdSlot slot="sidebar_top" />
              <AdSlot slot="sidebar_mid" />
              <AdSlot slot="sidebar_bot" />
            </div>
          </aside>
        </div>

        {/* Below lg the aside is hidden; render the same ads inline at
         * the end of main so mobile visitors still see them. */}
        <div className="mt-10 space-y-4 lg:hidden">
          <AdSlot slot="sidebar_top" />
          <AdSlot slot="sidebar_mid" />
          <AdSlot slot="sidebar_bot" />
        </div>
      </main>

      <div className="mx-auto w-full max-w-[1400px] px-4">
        <AdSlot slot="above_footer" />
        <AdSlot slot="footer_top" />
      </div>

      <footer
        className="mt-auto border-t"
        style={{ borderColor: "var(--tenant-border)", background: "#000" }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 text-center text-xs">
          <div className="flex flex-col items-center gap-1 text-white/40">
            <p>
              © {new Date().getFullYear()}{" "}
              <span className="font-semibold text-white/70">{tenant.name}</span>.
              All rights reserved.
            </p>
            <p>🔞 18+ Adults Only</p>
          </div>
        </div>
      </footer>

      <div className="mx-auto w-full max-w-[1400px] px-4">
        <AdSlot slot="footer_bottom" />
      </div>

      {/* Sticky mobile ad bar. The AdSlot itself returns null when no
       * ad is configured, so the outer wrapper only reserves space when
       * there's something to show — otherwise the whole strip collapses
       * and mobile users don't see an empty black bar. */}
      <MobileStickyBar />
    </div>
  );
}

async function MobileStickyBar() {
  const tenant = await getCurrentTenant();
  const ads = await getTenantAds(tenant.id, "sticky_bottom");
  if (ads.length === 0) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{
        background: "rgba(0, 0, 0, 0.9)",
        borderColor: "var(--tenant-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <AdSlot slot="sticky_bottom" />
    </div>
  );
}
