import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { createClient } from "./telegram-client.js";
import { getTelegramGroupIds } from "./config.js";
import { backfill, startRealtimeListener } from "./sync.js";

async function main() {
  console.log("[main] Starting Telegram sync service...");

  const client = await createClient();
  const groupIds = await getTelegramGroupIds();

  console.log(`[main] Target groups: ${groupIds.join(", ")}`);

  for (const groupId of groupIds) {
    console.log(`[main] Processing group: ${groupId}`);
    const group = await client.getEntity(groupId);

    // Phase 1: Backfill historical messages
    await backfill(client, group, groupId);

    // Phase 2: Listen for new messages in realtime
    await startRealtimeListener(client, group, groupId);
  }

  console.log("[main] Service running. Press Ctrl+C to stop.");
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[main] Received SIGTERM, shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[main] Received SIGINT, shutting down...");
  process.exit(0);
});

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
