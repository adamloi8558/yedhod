import { db } from "@kodhom/db";
import { pricingPlans } from "@kodhom/db/schema";
import { asc } from "drizzle-orm";
import { PricingList } from "@/components/pricing-list";

export default async function PricingPage() {
  const allPlans = await db
    .select()
    .from(pricingPlans)
    .orderBy(asc(pricingPlans.sortOrder));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">จัดการแพ็กเกจ</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pricing Plans</p>
      </div>
      <PricingList plans={allPlans} />
    </div>
  );
}
