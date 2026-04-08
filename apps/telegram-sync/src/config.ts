import { db, systemConfig } from "@kodhom/db";
import { eq } from "drizzle-orm";

export function getEnvConfig() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !session) {
    throw new Error(
      "Missing required env vars: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION"
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Missing required env var: DATABASE_URL");
  }

  return { apiId, apiHash, session };
}

export async function getTelegramGroupId(): Promise<string> {
  const config = await db.query.systemConfig.findFirst({
    where: eq(systemConfig.key, "telegram_group_id"),
  });

  if (!config?.value) {
    throw new Error(
      'Missing system config: telegram_group_id. Add it in the backoffice config page.'
    );
  }

  return String(config.value);
}
