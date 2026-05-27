import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@kodhom/db";
import {
  users,
  sessions,
  accounts,
  verifications,
  subscriptions,
  pricingPlans,
} from "@kodhom/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    session: {
      create: {
        // Auto-kick: when a new device logs in, keep only the newest
        // `maxDevices` sessions (including the one just created) and delete
        // the oldest ones. Enforces "1 device, new login kicks the oldest".
        after: async (session) => {
          try {
            const [user] = await db
              .select({ role: users.role })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);

            // Admins are never device-limited.
            if (user?.role === "admin") return;

            const now = new Date();
            const userPlans = await db
              .select({ maxDevices: pricingPlans.maxDevices })
              .from(subscriptions)
              .innerJoin(
                pricingPlans,
                eq(subscriptions.pricingPlanId, pricingPlans.id)
              )
              .where(
                and(
                  eq(subscriptions.userId, session.userId),
                  eq(subscriptions.status, "active"),
                  or(
                    isNull(subscriptions.endDate),
                    gt(subscriptions.endDate, now)
                  )
                )
              );

            const maxDevices =
              userPlans.length > 0
                ? Math.max(...userPlans.map((p) => p.maxDevices))
                : 1;

            const activeSessions = await db
              .select({ id: sessions.id, createdAt: sessions.createdAt })
              .from(sessions)
              .where(
                and(
                  eq(sessions.userId, session.userId),
                  gt(sessions.expiresAt, now)
                )
              )
              .orderBy(desc(sessions.createdAt));

            if (activeSessions.length <= maxDevices) return;

            // Keep the just-created session plus the newest (maxDevices - 1)
            // others; pinning the new id guards against createdAt ties.
            const keep = new Set<string>([
              session.id,
              ...activeSessions
                .filter((s) => s.id !== session.id)
                .slice(0, Math.max(maxDevices - 1, 0))
                .map((s) => s.id),
            ]);

            const toDelete = activeSessions
              .filter((s) => !keep.has(s.id))
              .map((s) => s.id);

            if (toDelete.length > 0) {
              await db.delete(sessions).where(inArray(sessions.id, toDelete));
            }
          } catch (error) {
            // Never block login on a device-limit failure.
            console.warn(
              "[auth] failed to enforce session device limit",
              error
            );
          }
        },
      },
    },
  },
  plugins: [
    multiSession({
      maximumSessions: 5,
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
        input: false,
        returned: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],
});

export type Auth = typeof auth;
