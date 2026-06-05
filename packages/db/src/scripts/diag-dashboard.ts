import { config } from "dotenv";
config({ path: "../../.env" });
config({ path: "../../../.env" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../index");
  const { payments, subscriptions, users, clips, categories } = await import("../schema");
  const { sql, eq, and, gte, lte, isNull, gt, or } = await import("drizzle-orm");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  console.log("=== Current time ===");
  console.log("now:", now.toISOString(), "month start:", monthStart.toISOString());

  console.log("\n=== payments table — all statuses (last 90 days) ===");
  const lastWeek = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const allPayments = await db
    .select({ status: payments.status, count: sql<number>`count(*)::int` })
    .from(payments)
    .where(gte(payments.createdAt, lastWeek))
    .groupBy(payments.status);
  console.log(allPayments);

  console.log("\n=== completed payments this month ===");
  const monthComp = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      bills: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.paidAt, monthStart),
        lte(payments.paidAt, now)
      )
    );
  console.log("by paidAt:", monthComp);

  const monthCompByCreated = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      bills: sql<number>`count(*)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "completed"),
        gte(payments.createdAt, monthStart),
        lte(payments.createdAt, now)
      )
    );
  console.log("by createdAt:", monthCompByCreated);

  console.log("\n=== completed payments ALL TIME ===");
  const allComp = await db
    .select({
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      bills: sql<number>`count(*)::int`,
      withPaidAt: sql<number>`count(paid_at)::int`,
      withoutPaidAt: sql<number>`count(*) filter (where paid_at is null)::int`,
    })
    .from(payments)
    .where(eq(payments.status, "completed"));
  console.log(allComp);

  console.log("\n=== Subscriptions ===");
  const subStat = await db
    .select({ status: subscriptions.status, count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .groupBy(subscriptions.status);
  console.log(subStat);

  const activeNow = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.endDate), gt(subscriptions.endDate, now))
      )
    );
  console.log("active VIP right now:", activeNow);

  console.log("\n=== Users ===");
  const userCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users);
  console.log("total users:", userCount);

  const newUsersMonth = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(and(gte(users.createdAt, monthStart), lte(users.createdAt, now)));
  console.log("new users this month:", newUsersMonth);

  console.log("\n=== Clips ===");
  const activeClipCount = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clips)
    .where(eq(clips.isActive, true));
  console.log("active clips (clip.isActive=true):", activeClipCount);

  console.log("\n=== Clip VIP by category vs clip access_level ===");
  const vipByCategory = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clips)
    .innerJoin(categories, eq(clips.categoryId, categories.id))
    .where(and(eq(clips.isActive, true), eq(categories.accessLevel, "vip")));
  console.log("VIP via CATEGORY.accessLevel=vip:", vipByCategory);

  const vipByClip = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clips)
    .where(and(eq(clips.isActive, true), eq(clips.accessLevel, "vip")));
  console.log("VIP via CLIP.accessLevel=vip:", vipByClip);

  console.log("\n=== Pending easyslip payments ===");
  const pending = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(payments)
    .where(and(eq(payments.status, "pending"), eq(payments.provider, "easyslip")));
  console.log("pending easyslip:", pending);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
