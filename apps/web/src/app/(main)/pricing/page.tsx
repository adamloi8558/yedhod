import { db } from "@kodhom/db";
import { pricingPlans } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { PricingCard } from "@/components/pricing-card";
import { getSession } from "@/lib/auth-server";

export default async function PricingPage() {
  const [allPlans, session] = await Promise.all([
    db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.isActive, true))
      .orderBy(asc(pricingPlans.sortOrder)),
    getSession(),
  ]);
  const isLoggedIn = !!session?.user;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">แพ็กเกจสมาชิก</h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          เลือกแพ็กเกจที่เหมาะกับคุณ
        </p>
      </div>

      {allPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแพ็กเกจ</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {allPlans.map((plan: typeof allPlans[number], index: number) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              featured={index === Math.floor(allPlans.length / 2) && allPlans.length > 1}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
