import "dotenv/config";
import { db } from "@kodhom/db";
import { tenants, tenantCategories, categories } from "@kodhom/db/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "../src/lib/nanoid";

async function main() {
  const domain = "site-a.local";
  const existing = await db
    .select()
    .from(tenants)
    .where(eq(tenants.primaryDomain, domain))
    .limit(1);
  let tenantId = existing[0]?.id;

  if (!tenantId) {
    tenantId = nanoid();
    await db.insert(tenants).values({
      id: tenantId,
      slug: "site-a",
      name: "Site A Demo",
      primaryDomain: domain,
      tagline: "Dev demo tenant",
      isActive: true,
    });
    console.log("created tenant", tenantId);
  } else {
    console.log("tenant exists", tenantId);
  }

  const memberCats = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.accessLevel, "member"), eq(categories.isActive, true)))
    .limit(5);

  for (let i = 0; i < memberCats.length; i++) {
    const c = memberCats[i]!;
    const dup = await db
      .select()
      .from(tenantCategories)
      .where(
        and(
          eq(tenantCategories.tenantId, tenantId!),
          eq(tenantCategories.categoryId, c.id)
        )
      )
      .limit(1);
    if (dup.length === 0) {
      await db.insert(tenantCategories).values({
        id: nanoid(),
        tenantId: tenantId!,
        categoryId: c.id,
        sortOrder: i,
      });
    }
  }

  console.log("done. add to hosts:  127.0.0.1  site-a.local");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
