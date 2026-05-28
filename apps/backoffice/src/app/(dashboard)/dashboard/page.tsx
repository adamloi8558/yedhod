import { requireAdmin } from "@/lib/auth-server";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  await requireAdmin();
  return <DashboardClient />;
}
