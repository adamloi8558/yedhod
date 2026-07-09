import Link from "next/link";
import { Search, Menu } from "lucide-react";
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
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <AdSlot slot="popunder" />
      <AdSlot slot="header_top" />

      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(13, 13, 15, 0.85)",
          borderColor: "var(--tenant-border)",
          backdropFilter: "saturate(140%) blur(8px)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <button
            aria-label="menu"
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={tenant.name} className="h-8" />
            ) : (
              <span
                className="text-xl font-extrabold tracking-tight"
                style={{ color: "var(--tenant-primary)" }}
              >
                {tenant.name}
              </span>
            )}
          </Link>

          {/* Search — non-functional visual placeholder for v1 */}
          <form
            action="/"
            className="ml-4 hidden max-w-2xl flex-1 items-center gap-2 rounded-lg border px-3 py-1.5 md:flex"
            style={{ background: "var(--tenant-panel)", borderColor: "var(--tenant-border)" }}
          >
            <Search size={16} className="text-white/40" />
            <input
              type="text"
              placeholder="ค้นหาคลิป..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
              disabled
            />
          </form>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            {tenant.tagline && (
              <span className="text-xs text-white/50">{tenant.tagline}</span>
            )}
          </div>
        </div>

        {/* Category strip */}
        {cats.length > 0 && (
          <div className="border-t" style={{ borderColor: "var(--tenant-border)" }}>
            <div className="mx-auto max-w-[1400px] px-4">
              <nav className="strip-scroll overflow-x-auto">
                <ul className="flex items-center gap-1 whitespace-nowrap py-2">
                  <li>
                    <Link
                      href="/"
                      className="rounded-md px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
                      style={{ background: "var(--tenant-panel)" }}
                    >
                      หน้าแรก
                    </Link>
                  </li>
                  {cats.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/category/${c.slug}`}
                        className="rounded-md px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
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

      <AdSlot slot="header_bottom" />

      {/* Main */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{children}</div>
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(3.5rem+3rem)] space-y-4">
              <AdSlot slot="sidebar_top" />
              <AdSlot slot="sidebar_mid" />
              <AdSlot slot="sidebar_bot" />
            </div>
          </aside>
        </div>
      </main>

      <AdSlot slot="footer_top" />

      <footer
        className="mt-auto border-t"
        style={{ borderColor: "var(--tenant-border)" }}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-8 text-sm">
          {tenant.footerText && (
            <p className="mb-3 text-white/60">{tenant.footerText}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-white/40">
            <p>
              © {new Date().getFullYear()}{" "}
              <span className="text-white/70">{tenant.name}</span>. All rights reserved.
            </p>
            <p className="text-xs">🔞 18+ Adults Only</p>
          </div>
        </div>
      </footer>

      <AdSlot slot="footer_bottom" />

      {/* Sticky mobile bottom ad */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
        style={{
          background: "rgba(13, 13, 15, 0.9)",
          borderColor: "var(--tenant-border)",
          backdropFilter: "blur(8px)",
        }}
      >
        <AdSlot slot="sticky_bottom" />
      </div>
    </div>
  );
}
