import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { db } from "@kodhom/db";
import { users, sessions, accounts, verifications } from "@kodhom/db/schema";

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
