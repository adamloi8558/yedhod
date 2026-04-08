import { db } from "@kodhom/db";
import { subscriptions, sessions, pricingPlans } from "@kodhom/db/schema";
import { eq, and, gt, count } from "drizzle-orm";

interface UserInfo {
  id: string;
  role: string;
}

/**
 * Check if a subscription is active and not expired.
 */
export async function getActiveSubscription(userId: string, categoryId: string) {
  const now = new Date();

  const [sub] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      endDate: subscriptions.endDate,
      pricingPlanId: subscriptions.pricingPlanId,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.categoryId, categoryId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1);

  if (!sub) return null;

  // Check if subscription has expired
  if (sub.endDate && new Date(sub.endDate) < now) {
    // Mark as expired in DB
    await db
      .update(subscriptions)
      .set({ status: "expired" })
      .where(eq(subscriptions.id, sub.id));
    return null;
  }

  return sub;
}

/**
 * Get all active (non-expired) subscription category IDs for a user.
 */
export async function getActiveSubscriptionCategories(userId: string) {
  const now = new Date();

  const subs = await db
    .select({
      id: subscriptions.id,
      categoryId: subscriptions.categoryId,
      endDate: subscriptions.endDate,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      )
    );

  const active: string[] = [];
  const expired: string[] = [];

  for (const sub of subs) {
    if (sub.endDate && new Date(sub.endDate) < now) {
      expired.push(sub.id);
    } else {
      active.push(sub.categoryId);
    }
  }

  // Batch-expire old subscriptions
  if (expired.length > 0) {
    for (const id of expired) {
      await db
        .update(subscriptions)
        .set({ status: "expired" })
        .where(eq(subscriptions.id, id));
    }
  }

  return new Set(active);
}

/**
 * Check if user has access to a clip.
 */
export function hasClipAccess(
  userRole: string,
  clipAccessLevel: "member" | "vip",
  hasSubscription: boolean
): boolean {
  if (userRole === "admin") return true;
  if (!hasSubscription) return false;
  if (clipAccessLevel === "member") return true;
  if (clipAccessLevel === "vip" && userRole === "vip") return true;
  return false;
}

/**
 * Check device limit for a user.
 * Returns { allowed: boolean, current: number, max: number }
 */
export async function checkDeviceLimit(userId: string) {
  // Count current active sessions
  const [sessionCount] = await db
    .select({ count: count() })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        gt(sessions.expiresAt, new Date())
      )
    );

  // Get the max devices from user's active subscriptions
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

  // Use the highest maxDevices from any active plan, fallback to 1
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
