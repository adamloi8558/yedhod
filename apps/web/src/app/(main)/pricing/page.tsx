import { db } from "@kodhom/db";
import { categories, pricingPlans } from "@kodhom/db/schema";
import { eq, asc } from "drizzle-orm";
import { PricingCard } from "@/components/pricing-card";

export default async function PricingPage() {
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));

  const allPlans = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, true))
    .orderBy(asc(pricingPlans.sortOrder));

  const plansByCategory = allCategories.map((cat) => ({
    category: cat,
    plans: allPlans.filter((p) => p.categoryId === cat.id),
  }));

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">แพ็กเกจสมาชิก</h1>
        <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
          เลือกแพ็กเกจที่เหมาะกับคุณ แต่ละหมวดหมู่ซื้อแยกกัน
        </p>
      </div>

      {plansByCategory.map(({ category, plans }) => (
        <div key={category.id} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold">{category.name}</h2>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีแพ็กเกจ</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan, index) => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  categoryId={category.id}
                  featured={index === Math.floor(plans.length / 2) && plans.length > 1}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
