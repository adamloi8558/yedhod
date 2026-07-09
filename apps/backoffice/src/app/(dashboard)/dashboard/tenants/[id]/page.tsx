import { notFound } from "next/navigation";
import { db } from "@kodhom/db";
import { tenants, categories, tenantCategories, tenantAds } from "@kodhom/db/schema";
import { eq, asc, and } from "drizzle-orm";
import EditTenantForm from "./edit-tenant-form";

export const dynamic = "force-dynamic";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!t) notFound();

  const memberCats = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(categories)
    .where(and(eq(categories.accessLevel, "member"), eq(categories.isActive, true)))
    .orderBy(asc(categories.name));

  const chosen = await db
    .select()
    .from(tenantCategories)
    .where(eq(tenantCategories.tenantId, id));

  const ads = await db
    .select()
    .from(tenantAds)
    .where(eq(tenantAds.tenantId, id))
    .orderBy(asc(tenantAds.slot), asc(tenantAds.sortOrder));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t.name}</h1>
      <EditTenantForm
        tenant={t}
        memberCategories={memberCats}
        chosenCategories={chosen.map((c) => ({
          categoryId: c.categoryId,
          sortOrder: c.sortOrder,
        }))}
        ads={ads}
      />
    </div>
  );
}
