import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";

const variants = [
  "-3832146288",      // as given
  "-1003832146288",   // supergroup ID with -100 prefix
  "3832146288",       // unsigned
];

async function main() {
  const row = await db.query.systemConfig.findFirst({ where: eq(systemConfig.key, "telegram_poster_bot_token") });
  const token = String(row?.value ?? "");

  // Also dump getUpdates so we can see what chats the bot has seen
  const updates = await fetch(`https://api.telegram.org/bot${token}/getUpdates`).then(r => r.json());
  console.log("=== getUpdates (recent chats bot saw) ===");
  if (updates.ok && updates.result?.length) {
    const seenChats = new Map();
    for (const u of updates.result) {
      const c = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
      if (c) seenChats.set(c.id, { id: c.id, type: c.type, title: c.title });
    }
    console.log([...seenChats.values()]);
  } else {
    console.log("(no updates / empty / err)", updates);
  }

  for (const v of variants) {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(v)}`).then(x => x.json());
    console.log(`\nvariant ${v}:`, r.ok ? `OK title=${r.result.title}` : r.description);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
