import "dotenv/config";
import { createClient } from "./telegram-client.js";
import { getTelegramGroupId } from "./config.js";
import { backfill, startRealtimeListener } from "./sync.js";

async function main() {
  console.log("[main] Starting Telegram sync service...");

  const client = await createClient();
  const groupId = await getTelegramGroupId();

  console.log(`[main] Target group: ${groupId}`);

  const group = await client.getEntity(groupId);

  // Phase 1: Backfill historical messages
  await backfill(client, group, groupId);

  // Phase 2: Listen for new messages in realtime
  await startRealtimeListener(client, group, groupId);

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
