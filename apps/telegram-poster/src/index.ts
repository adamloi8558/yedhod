import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { Bot } from "grammy";
import { getBotToken, getTargetGroups } from "./config.js";
import { pollAndPost } from "./poster.js";
import { delay } from "./utils.js";

const POLL_INTERVAL = 60_000; // 60 seconds

async function main() {
  console.log("[main] Starting Telegram poster service...");

  const botToken = await getBotToken();
  const targetGroupIds = await getTargetGroups();

  const bot = new Bot(botToken);

  // Verify bot connection
  const me = await bot.api.getMe();
  console.log(`[main] Bot connected: @${me.username}`);
  console.log(`[main] Target groups: ${targetGroupIds.join(", ")}`);

  async function runOnce() {
    // Each group has its own telegram_posted_clips row, so a clip
    // that's been mirrored to group A but not B will still surface
    // in B's poll. We iterate sequentially to keep our per-poll
    // rate-limit predictable across chats.
    for (const gid of targetGroupIds) {
      try {
        await pollAndPost(bot, gid);
      } catch (err) {
        console.error(`[main] Poll error for ${gid}:`, err);
      }
    }
  }

  await runOnce();

  console.log(`[main] Polling every ${POLL_INTERVAL / 1000}s for new clips...`);
  while (true) {
    await delay(POLL_INTERVAL);
    await runOnce();
  }
}

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
