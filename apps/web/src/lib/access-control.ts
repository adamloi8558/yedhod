import { db } from "@kodhom/db";
import { subscriptions, sessions, pricingPlans } from "@kodhom/db/schema";
import { eq, and, gt, count } from "drizzle-orm";

/**
 * Check if user has any active (non-expired) subscription.
 * Global — not tied to any specific category.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const now = new Date();

  const subs = await db
    .select({
      id: subscriptions.id,
      endDate: subscriptions.endDate,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    );

  const expired: string[] = [];
  let hasActive = false;

  for (const sub of subs) {
    if (sub.endDate && new Date(sub.endDate) < now) {
      expired.push(sub.id);
    } else {
      hasActive = true;
    }
  }

  // Batch-expire old subscriptions
  for (const id of expired) {
    await db
      .update(subscriptions)
      .set({ status: "expired" })
      .where(eq(subscriptions.id, id));
  }

  return hasActive;
}

/**
 * Check if user has access to a category.
 * - Admin: always true
 * - category.accessLevel = "member": everyone can access
 * - category.accessLevel = "vip": only users with active subscription
 */
export function hasCategoryAccess(
  userRole: string,
  categoryAccessLevel: "member" | "vip",
  hasSubscription: boolean
): boolean {
  if (userRole === "admin") return true;
  if (categoryAccessLevel === "member") return true;
  if (categoryAccessLevel === "vip" && hasSubscription) return true;
  return false;
}

/**
 * Check device limit for a user.
 */
export async function checkDeviceLimit(userId: string) {
  const [sessionCount] = await db
    .select({ count: count() })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        gt(sessions.expiresAt, new Date())
      )
    );

  const userPlans = await db
    .select({
      maxDevices: pricingPlans.maxDevices,
    })
    .from(subscriptions)
    .innerJoin(pricingPlans, eq(subscriptions.pricingPlanId, pricingPlans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    );

  const maxDevices = userPlans.length > 0
    ? Math.max(...userPlans.map((p) => p.maxDevices))
    : 1;

  const current = sessionCount.count;

  return {
    allowed: current < maxDevices,
    current,
    max: maxDevices,
  };
}
