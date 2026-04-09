import { db, systemConfig } from "@kodhom/db";
import { eq } from "drizzle-orm";

export async function getBotToken(): Promise<string> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_bot_token"),
  });

  if (!config?.value) {
    throw new Error(
      "Missing system config: telegram_poster_bot_token. Add it in the backoffice config page."
    );
  }

  return String(config.value);
}

export async function getTargetGroup(): Promise<string> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_poster_target_group"),
  });

  if (!config?.value) {
    throw new Error(
      "Missing system config: telegram_poster_target_group. Add it in the backoffice config page."
    );
  }

  return String(config.value);
}
