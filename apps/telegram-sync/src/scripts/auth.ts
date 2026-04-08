import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first");
  process.exit(1);
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => await input.text("Phone number: "),
  phoneCode: async () => await input.text("OTP code: "),
  password: async () => await input.text("2FA password (if any): "),
  onError: (err) => console.error(err),
});

console.log("\n✅ Authenticated successfully!\n");
console.log("Session string (save as TELEGRAM_SESSION env var):\n");
console.log(client.session.save());
console.log();

await client.disconnect();
