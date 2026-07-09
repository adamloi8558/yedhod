import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@kodhom/db";
import { tenants } from "@kodhom/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

export type Tenant = typeof tenants.$inferSelect;

export const getCurrentTenant = cache(async (): Promise<Tenant> => {
  const h = await headers();
  const domain = h.get("x-tenant-domain") ?? "";
  if (!domain) notFound();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.primaryDomain, domain), eq(tenants.isActive, true)))
    .limit(1);

  if (!tenant) notFound();
  return tenant;
});
