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
    }
  );

  await client.connect();
  console.log("[telegram] Connected as user");

  return client;
}
