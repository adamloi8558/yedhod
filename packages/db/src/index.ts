import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Singleton: Next.js HMR re-evaluates this module on every hot reload in
// dev, which used to spin up a brand-new postgres pool each time without
// releasing the old one — eventually triggering "too many clients already".
// We stash the client on globalThis so reloads reuse the same pool.
const globalForPg = globalThis as unknown as {
  __kodhom_pg__?: ReturnType<typeof postgres>;
};

const client =
  globalForPg.__kodhom_pg__ ??
  postgres(connectionString, {
    // Cap concurrency so even a runaway client can't exhaust the server.
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__kodhom_pg__ = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from "./schema";
export { schema };
