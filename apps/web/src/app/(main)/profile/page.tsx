import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { db } from "@kodhom/db";
import { subscriptions, categories, pricingPlans } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@kodhom/ui/components/card";
import { Badge } from "@kodhom/ui/components/badge";
import { formatThaiDate } from "@kodhom/ui/lib/utils";
import { AvatarUpload } from "@/components/avatar-upload";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const userSubs = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      categoryName: categories.name,
      planName: pricingPlans.name,
    })
    .from(subscriptions)
    .innerJoin(categories, eq(subscriptions.categoryId, categories.id))
    .innerJoin(pricingPlans, eq(subscriptions.pricingPlanId, pricingPlans.id))
    .where(eq(subscriptions.userId, session.user.id));

  const userRole = (session.user as any).role ?? "member";

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 animate-fade-in">
      <h1 className="mb-6 text-2xl font-bold gradient-text">โปรไฟล์</h1>

      <Card className="mb-6 rounded-2xl border-border/50 overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
        <CardHeader className="-mt-12 pb-2">
          <CardTitle className="sr-only">ข้อมูลบัญชี</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <AvatarUpload
            currentImage={session.user.image ?? undefined}
            userName={session.user.name}
          />
          <div className="grid gap-3 pt-2">
            <div className="flex justify-between items-center rounded-xl bg-accent/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">อีเมล</span>
              <span className="text-sm font-medium">{session.user.email}</span>
            </div>
            <div className="flex justify-between items-center rounded-xl bg-accent/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">สถานะ</span>
              <Badge variant={userRole === "vip" ? "vip" : "secondary"} className={userRole === "vip" ? "animate-pulse-glow" : ""}>
                {userRole.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">การสมัครสมาชิก</CardTitle>
        </CardHeader>
        <CardContent>
          {userSubs.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-3">
                <span className="text-xl opacity-40">📋</span>
              </div>
              <p className="text-sm text-muted-foreground">ยังไม่มีการสมัครสมาชิก</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userSubs.map((sub) => (
                <div
                  key={sub.id}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-smooth hover:bg-accent/30 ${sub.status === "active" ? "border-primary/20" : "border-border/50"}`}
                >
                  <div>
                    <p className="text-sm font-semibold">{sub.categoryName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub.planName}</p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={sub.status === "active" ? "default" : "secondary"}
                      className={sub.status === "active" ? "bg-green-500/15 text-green-400 border border-green-500/20" : ""}
                    >
                      {sub.status === "active" ? "ใช้งานอยู่" : sub.status}
                    </Badge>
                    {sub.endDate && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                        หมดอายุ {formatThaiDate(new Date(sub.endDate))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
