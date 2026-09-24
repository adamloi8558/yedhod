import { TelegramClient, Api } from "telegram";
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

  const invokeWithSender = client.invokeWithSender.bind(client);
  client.invokeWithSender = async (request, sender) => {
    for (let attempt = 0; ; attempt++) {
      try { return await invokeWithSender(request, sender); }
      catch (error) {
        const rpc = error as { code?: number; errorMessage?: string } | null;
        // GramJS does not retry Telegram's mixed-case, negative-code Timeout.
        // Only retry the read-only file request, preserving the current offset.
        if (!(request instanceof Api.upload.GetFile) || rpc?.code !== -503 ||
          rpc.errorMessage?.toUpperCase() !== "TIMEOUT" || attempt >= 2) throw error;
        const wait = 2000 * (attempt + 1);
        console.warn(`[telegram] Retrying timed-out file chunk in ${wait}ms (${attempt + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
  };

  await client.connect();
  if (!(await client.checkAuthorization())) {
    await client.disconnect();
    throw new Error("Telegram session is no longer authorized; renew this project's session");
  }
  console.log("[telegram] Connected as user");

  return client;
}
