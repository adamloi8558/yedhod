/**
 * Quick connect test for the configured TELEGRAM_SESSION.
 * Exits 0 on success, 1 on auth error, prints concise diagnosis.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const session = process.env.TELEGRAM_SESSION;

if (!apiId || !apiHash || !session) {
  console.error("missing env");
  process.exit(2);
}

const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
  connectionRetries: 0,
});

try {
  await client.connect();
  const me = await client.getMe();
  const meAny = me as { firstName?: string; phone?: string; id?: unknown };
  console.log(
    `OK auth ok user=${meAny.firstName ?? "?"} phone=${meAny.phone ?? "?"}`
  );
  await client.disconnect();
  process.exit(0);
} catch (err) {
  const e = err as { errorMessage?: string; message?: string };
  console.error(`FAIL ${e.errorMessage ?? e.message ?? "unknown"}`);
  await client.disconnect().catch(() => {});
  process.exit(1);
}
