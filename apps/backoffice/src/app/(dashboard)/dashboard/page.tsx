import { db } from "@kodhom/db";
import { users, clips, categories, subscriptions, payments } from "@kodhom/db/schema";
import { count, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Users as UsersIcon, Film, FolderOpen, CreditCard } from "lucide-react";

export default async function DashboardPage() {
  const [userCount] = await db.select({ count: count() }).from(users);
  const [clipCount] = await db.select({ count: count() }).from(clips);
  const [categoryCount] = await db.select({ count: count() }).from(categories);
  const [activeSubCount] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const stats = [
    { label: "ผู้ใช้ทั้งหมด", value: userCount.count, icon: UsersIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "คลิปทั้งหมด", value: clipCount.count, icon: Film, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "หมวดหมู่", value: categoryCount.count, icon: FolderOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "สมาชิกที่ใช้งาน", value: activeSubCount.count, icon: CreditCard, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">แดชบอร์ด</h1>
        <p className="mt-1 text-sm text-muted-foreground">ศูนย์ควบคุมระบบ</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="stat-card border-border/50 bg-card/80" style={{ animationDelay: `${i * 80}ms` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-foreground">{stat.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
