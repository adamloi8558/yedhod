import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant";
import { getTenantCategories } from "@/lib/tenant-queries";
import { AdSlot } from "./ad-slot";

export async function TenantShell({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  const cats = await getTenantCategories(tenant.id);
  // Logo goes through /api/tenant/logo so <img src> stays on this domain.
  const logo = tenant.logoR2Key ? "/api/tenant/logo" : null;

  return (
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <AdSlot slot="popunder" />
      <AdSlot slot="header_top" />

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

      <AdSlot slot="header_bottom" />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">
        {children}
        <div className="mt-10 space-y-4">
          <AdSlot slot="sidebar_top" />
          <AdSlot slot="sidebar_mid" />
          <AdSlot slot="sidebar_bot" />
        </div>
      </main>

      <AdSlot slot="footer_top" />

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

      <AdSlot slot="footer_bottom" />

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
    </div>
  );
}
