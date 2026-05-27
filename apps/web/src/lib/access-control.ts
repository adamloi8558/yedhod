import { db } from "@kodhom/db";
import { subscriptions, sessions, pricingPlans } from "@kodhom/db/schema";
import { eq, and, gt, lt, count, isNotNull, isNull, or } from "drizzle-orm";

/**
 * Check if user has any active (non-expired) subscription.
 * Global — not tied to any specific category.
 * Side effect: bulk-marks past-endDate active rows as expired.
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const now = new Date();

  await db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        isNotNull(subscriptions.endDate),
        lt(subscriptions.endDate, now)
      )
    );

  const [row] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    );

  return row.count > 0;
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

  const now = new Date();
  const userPlans = await db
    .select({
      maxDevices: pricingPlans.maxDevices,
    })
    .from(subscriptions)
    .innerJoin(pricingPlans, eq(subscriptions.pricingPlanId, pricingPlans.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        // Don't count past-endDate rows that hasActiveSubscription hasn't
        // bulk-expired yet. endDate=null means lifetime — keep those.
        or(isNull(subscriptions.endDate), gt(subscriptions.endDate, now))
      )
    );

  const maxDevices = userPlans.length > 0
    ? Math.max(...userPlans.map((p) => p.maxDevices))
    : 1;

  const current = sessionCount.count;

  // The requesting user's own session is included in `current`, and the
  // login hook (packages/auth) already trims sessions down to `maxDevices`.
  // So being AT the limit is allowed; only an over-limit count (e.g. a brief
  // race before the hook trims, or concurrent tabs) is rejected.
  return {
    allowed: current <= maxDevices,
    current,
    max: maxDevices,
  };
}
