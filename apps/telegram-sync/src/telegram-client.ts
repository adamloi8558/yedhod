import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { getEnvConfig } from "./config.js";

export async function createClient(): Promise<TelegramClient> {
  const { apiId, apiHash, session } = getEnvConfig();

  const client = new TelegramClient(
    new StringSession(session),
    apiId,
    apiHash,
    {
      connectionRetries: 5,
      // The worker is serial: short waits can resume the same file chunk safely.
      // Longer waits still propagate to the account-wide scheduler.
      floodSleepThreshold: 60,
    }
  );

  await client.connect();
  if (!(await client.checkAuthorization())) {
    await client.disconnect();
    throw new Error("Telegram session is no longer authorized; renew this project's session");
  }
  console.log("[telegram] Connected as user");

  return client;
}
