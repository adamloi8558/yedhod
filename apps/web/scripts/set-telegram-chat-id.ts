import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq, sql } from "drizzle-orm";

const CHAT_ID = "-1003915116861";

async function main() {
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "telegram_support"))
    .limit(1);

  if (!existing) {
    console.error("No telegram_support row — bot token must be seeded first.");
    process.exit(1);
  }

  const old = existing.value as { botToken?: string; chatId?: string } | null;
  const next = {
    botToken: old?.botToken ?? "",
    chatId: CHAT_ID,
  };
  await db
    .update(systemConfig)
    .set({ value: next, updatedAt: sql`now()` })
    .where(eq(systemConfig.key, "telegram_support"));
  console.log("Updated telegram_support.chatId → " + CHAT_ID);

  // Smoke test: send a hello message right away.
  if (!next.botToken) {
    console.warn("No botToken set — skipping smoke test");
    process.exit(0);
  }
  const text =
    "✅ <b>เชื่อมต่อสำเร็จ</b>\n" +
    "ระบบ ticket ของ <b>เย็ดโหด</b> จะส่งแจ้งเตือนมาที่ห้องนี้ตั้งแต่นี้ไป";
  const res = await fetch(
    `https://api.telegram.org/bot${next.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    }
  );
  const body = await res.text();
  console.log("Telegram response:", res.status, body.slice(0, 300));

  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
