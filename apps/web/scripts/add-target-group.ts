import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../../../.env") });
import { db } from "@kodhom/db";
import { systemConfig } from "@kodhom/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const NEW = "-1003832146288";
  const EXISTING = "-1003988294101";
  const list = [EXISTING, NEW];

  const existing = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_target_groups"),
  });
  if (existing) {
    await db.update(systemConfig)
      .set({ value: list as any, updatedAt: sql`now()` })
      .where(eq(systemConfig.key, "telegram_poster_target_groups"));
    console.log("Updated telegram_poster_target_groups →", list);
  } else {
    await db.insert(systemConfig).values({
      id: crypto.randomUUID(),
      key: "telegram_poster_target_groups",
      value: list as any,
      description: "List of Telegram chat ids the poster mirrors clips to.",
    });
    console.log("Inserted telegram_poster_target_groups →", list);
  }

  // Smoke test in both
  const tokenRow = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_bot_token"),
  });
  const token = String(tokenRow?.value ?? "");
  for (const id of list) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: id,
        text: id === NEW
          ? "✅ Poster เริ่มเชื่อมต่อห้องนี้แล้ว — จะส่งคลิปใหม่อัตโนมัติ"
          : "ℹ️ Poster กำลังขยายไปอีกห้อง — ห้องนี้รับคลิปต่อตามปกติ",
      }),
    }).then(x => x.json());
    console.log(id, r.ok ? "OK" : r);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
