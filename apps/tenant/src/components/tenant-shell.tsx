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
          background: "rgba(13, 13, 15, 0.88)",
          borderColor: "var(--tenant-border)",
          backdropFilter: "saturate(140%) blur(10px)",
        }}
      >
        <div className="mx-auto flex h-20 max-w-[1400px] items-center gap-6 px-6">
          <button
            aria-label="menu"
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Menu size={22} />
          </button>

          {/* Logo — centered on mobile */}
          <Link href="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={tenant.name} className="h-10" />
            ) : (
              <span
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: "var(--tenant-primary)" }}
              >
                {tenant.name}
              </span>
            )}
          </Link>

          {/* Search — centered flex-1 */}
          <form
            action="/"
            className="mx-auto hidden h-11 w-full max-w-xl items-center gap-2 rounded-full border px-5 md:flex"
            style={{ background: "var(--tenant-panel)", borderColor: "var(--tenant-border)" }}
          >
            <Search size={18} className="text-white/40" />
            <input
              type="text"
              placeholder="ค้นหาคลิป..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
              disabled
            />
          </form>

          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {tenant.tagline && (
              <span className="text-xs text-white/50">{tenant.tagline}</span>
            )}
          </div>
        </div>

        {/* Category strip — centered */}
        {cats.length > 0 && (
          <div className="border-t" style={{ borderColor: "var(--tenant-border)" }}>
            <div className="mx-auto max-w-[1400px] px-6">
              <nav className="strip-scroll overflow-x-auto">
                <ul className="flex items-center justify-center gap-1 whitespace-nowrap py-3">
                  <li>
                    <Link
                      href="/"
                      className="rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      style={{ background: "var(--tenant-primary)" }}
                    >
                      หน้าแรก
                    </Link>
                  </li>
                  {cats.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/category/${c.slug}`}
                        className="rounded-full px-4 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
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
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{children}</div>
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(5rem+3.5rem)] space-y-4">
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
        <div className="mx-auto max-w-[1400px] px-6 py-10 text-center text-sm">
          {tenant.footerText && (
            <p className="mb-4 text-white/60">{tenant.footerText}</p>
          )}
          <div className="flex flex-col items-center gap-2 text-white/40">
            <p>
              © {new Date().getFullYear()}{" "}
              <span className="font-semibold text-white/70">{tenant.name}</span>.
              All rights reserved.
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
