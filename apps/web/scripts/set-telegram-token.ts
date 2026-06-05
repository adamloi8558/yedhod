import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });

import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq, sql } from "drizzle-orm";

const BOT_TOKEN = "7556860181:AAFkt7Txhmc7DIf3owF-hIbBlrRv8ki-urU";

async function main() {
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "telegram_support"))
    .limit(1);

  const newValue = {
    botToken: BOT_TOKEN,
    chatId: existing
      ? ((existing.value as { chatId?: string } | null)?.chatId ?? "")
      : "",
  };

  if (existing) {
    await db
      .update(systemConfig)
      .set({ value: newValue, updatedAt: sql`now()` })
      .where(eq(systemConfig.key, "telegram_support"));
    console.log("Updated telegram_support.botToken");
  } else {
    await db.insert(systemConfig).values({
      id: crypto.randomUUID(),
      key: "telegram_support",
      value: newValue,
    });
    console.log("Inserted telegram_support");
  }
  console.log("Current value:", newValue);
  console.log(
    "\n→ Admin must set chatId via system_config.telegram_support.chatId (group/channel/user id)"
  );
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
