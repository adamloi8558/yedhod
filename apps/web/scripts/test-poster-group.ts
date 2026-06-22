import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq } from "drizzle-orm";

const newGroupId = process.argv[2];
if (!newGroupId) { console.error("usage: <script> <chat_id>"); process.exit(1); }

async function main() {
  // Use telegram_poster_bot_token (the @yedhodbot the poster actually uses)
  const row = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_bot_token"),
  });
  const token = row?.value ? String(row.value) : "";
  if (!token) { console.error("no poster bot token"); process.exit(1); }

  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then(r => r.json());
  console.log("bot:", me.ok ? "@" + me.result.username : me);

  const info = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(newGroupId)}`).then(r => r.json());
  console.log("getChat:", JSON.stringify(info, null, 2));
  if (!info.ok) process.exit(2);

  const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: newGroupId, text: "✅ Test: poster เชื่อมต่อห้องนี้สำเร็จ (จะเริ่มส่งคลิปอัตโนมัติ)" }),
  }).then(r => r.json());
  console.log("sendMessage:", send.ok ? "OK msg_id=" + send.result.message_id : send);
  process.exit(send.ok ? 0 : 3);
}
main().catch(e => { console.error(e); process.exit(1); });
