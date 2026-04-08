import { requireAdmin } from "@/lib/auth-server";
import { AdminSidebar } from "@/components/admin-sidebar";
import { MobileMenuProvider } from "@/components/mobile-menu";
import { MobileHeader } from "@/components/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <MobileMenuProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar user={session.user} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar — only visible below lg */}
          <MobileHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl animate-fade-in p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </MobileMenuProvider>
  );
}
