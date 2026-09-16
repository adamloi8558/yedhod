import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { createClient } from "./telegram-client.js";
import { getTelegramGroupIds } from "./config.js";
import { backfill } from "./sync.js";
import { retryDelayMs } from "./retry.js";
import { delay } from "./utils.js";
import type { Api } from "telegram";
import { db } from "@kodhom/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[main] Starting Telegram sync with periodic catch-up...");
  const client = await createClient();
  const groups = [...new Set(await getTelegramGroupIds())];
  if (!groups.length) throw new Error("No Telegram groups configured");
  // Resolve private numeric groups using the account's dialog/access-hash cache.
  let dialogsLoaded = false;
  const states = groups.map(id => ({ id, entity: null as Api.TypeEntityLike | null, failures: 0, retryAt: 0, lastSuccess: null as string | null }));
  // Polling is deliberately serial. No backfill/realtime overlap, missed startup
  // listeners, unbounded event downloads, or repeated username resolution.
  while (true) {
    for (const state of states) {
      if (Date.now() < state.retryAt) continue;
      try {
        if (!state.entity) {
          if (/^-?\d+$/.test(state.id) && !dialogsLoaded) {
            await client.getDialogs({ limit: 500 });
            dialogsLoaded = true;
          }
          state.entity = await client.getEntity(state.id);
        }
        const synced = await db.transaction(async tx => {
          const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtextextended(${"telegram-sync:" + state.id}, 0)) as locked`);
          if (!lock[0]?.locked) return false;
          await backfill(client, state.entity!, state.id);
          return true;
        });
        if (!synced) { state.retryAt = Date.now() + 60_000; continue; }
        state.failures = 0;
        state.lastSuccess = new Date().toISOString();
        state.retryAt = Date.now() + 60_000;
      } catch (error) {
        state.failures++;
        const wait = retryDelayMs(error, state.failures);
        state.retryAt = Date.now() + wait;
        console.error("[main] Group sync deferred", { group: state.id, retryAt: new Date(state.retryAt).toISOString(),
          error: error instanceof Error ? error.message : String(error) });
        const e = error as { seconds?: number; errorMessage?: string };
        if (e.seconds || /FLOOD/i.test(e.errorMessage ?? "")) {
          // Flood waits apply to this Telegram account, not just this group.
          for (const other of states) other.retryAt = Math.max(other.retryAt, state.retryAt);
          break;
        }
      }
      await delay(1000);
    }
    console.log("[main] Sync heartbeat", JSON.stringify(states.map(({ id, failures, retryAt, lastSuccess }) => ({ id, failures, retryAt, lastSuccess }))));
    await delay(30_000);
  }
}

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
main().catch(error => { console.error("[main] Fatal error:", error); process.exit(1); });
